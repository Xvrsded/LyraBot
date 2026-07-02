const eventBus = require('../../../services/eventBus');
const pipelineRegistry = require('../registry/pipelineRegistry');
const logger = require('../../../utils/logger');
const pipelineHealth = require('./pipelineHealth');

class PipelineManager {
    constructor() {
        this.activePipelines = new Map();
    }

    async executePipeline(context) {
        const metadata = pipelineRegistry.getActivityMetadata(context.activity);
        if (!metadata.enabled) {
            logger.debug(`[PipelineManager] Activity ${context.activity} is disabled. Skipping.`);
            eventBus.emit('pipeline.cancelled', { context, reason: 'Activity disabled' });
            return;
        }

        context.markStarted();
        this.activePipelines.set(context.correlationId, context);
        eventBus.emit('pipeline.started', { context });

        const stages = pipelineRegistry.getAllStages();
        
        // Split into Sequential and Parallel
        const sequentialStages = stages.filter(s => !s.isParallel);
        const parallelStages = stages.filter(s => s.isParallel);

        try {
            // Execute Sequential Stages
            for (const stage of sequentialStages) {
                await this._executeStage(stage, context, metadata.timeout);
            }

            // Execute Parallel Stages
            if (parallelStages.length > 0) {
                const parallelPromises = parallelStages.map(stage => this._executeStage(stage, context, metadata.timeout));
                await Promise.allSettled(parallelPromises);
            }

            context.markCompleted();
            pipelineHealth.recordSuccess(context.executionTime);
            eventBus.emit('pipeline.completed', { context });
            logger.debug(`[PipelineManager] Pipeline ${context.correlationId} completed in ${context.executionTime}ms`);
        } catch (error) {
            context.markCompleted();
            if (error.name === 'CooldownError') {
                logger.debug(`[PipelineManager] Pipeline ${context.correlationId} halted gracefully due to Cooldown`);
                eventBus.emit('pipeline.halted', { context, reason: 'Cooldown' });
                // Do not record as failure
                pipelineHealth.recordSuccess(context.executionTime);
            } else {
                pipelineHealth.recordFailure();
                logger.error(`[PipelineManager] Pipeline ${context.correlationId} failed:`, error);
                eventBus.emit('pipeline.failed', { context, error: error.message });
            }
        } finally {
            this.activePipelines.delete(context.correlationId);
        }
    }

    async _executeStage(stage, context, timeoutMs) {
        eventBus.emit('pipeline.stage.started', { stageId: stage.id, context });
        const startTime = Date.now();
        let timeoutHandle;

        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error('Stage Timeout')), timeoutMs);
            });

            // Race stage execution against timeout
            await Promise.race([
                stage.instance.execute(context),
                timeoutPromise
            ]);

            clearTimeout(timeoutHandle);
            const duration = Date.now() - startTime;
            context.addTrace(stage.id, 'success', duration);
            eventBus.emit('pipeline.stage.completed', { stageId: stage.id, duration, context });
        } catch (error) {
            clearTimeout(timeoutHandle);
            const duration = Date.now() - startTime;
            
            if (error.name === 'CooldownError') {
                context.addTrace(stage.id, 'skipped', duration, error);
                eventBus.emit('pipeline.stage.skipped', { stageId: stage.id, duration, reason: error.message, context });
                // If Cooldown throws, we gracefully stop the whole pipeline without throwing a critical error up
                throw error; // Will be caught by main loop to exit, we handle it in executePipeline
            }

            context.addTrace(stage.id, 'failed', duration, error);
            eventBus.emit('pipeline.stage.failed', { stageId: stage.id, duration, error: error.message, context });
            
            if (stage.abortOnFail) {
                throw new Error(`Critical stage ${stage.id} failed: ${error.message}`);
            } else {
                logger.warn(`[PipelineManager] Stage ${stage.id} failed, but abortOnFail is false. Continuing.`);
            }
        }
    }
}

module.exports = new PipelineManager();
