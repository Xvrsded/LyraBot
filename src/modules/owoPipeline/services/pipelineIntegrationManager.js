const pipelineRegistry = require('../registry/pipelineRegistry');
const defaultStages = require('../stages/defaultStages');
const pipelineManager = require('../pipeline/pipelineManager');
const pipelineHealth = require('../pipeline/pipelineHealth');
const PipelineContext = require('../pipeline/pipelineContext');
const logger = require('../../../utils/logger');

class PipelineIntegrationManager {
    constructor() {
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        logger.info('[OwOPipeline] Initializing Enterprise OwO Activity Pipeline...');

        pipelineRegistry.init();

        const eventBus = require('../../../services/eventBus');

        // Register Default Stages
        defaultStages.forEach(stage => {
            pipelineRegistry.registerStage(stage.id, stage, {
                isParallel: stage.isParallel,
                abortOnFail: stage.abortOnFail
            });
        });

        // Listen for live events from parser
        eventBus.subscribe('pipeline.execute', async (contextEvent) => {
            try {
                const activity = contextEvent.payload?.activity;
                const guildId = contextEvent.guildId;
                const userId = contextEvent.userId;
                const context = new PipelineContext(guildId, userId, activity, contextEvent.payload);
                await pipelineManager.executePipeline(context);
                
                eventBus.emit('pipeline.finished', { context });
                eventBus.emit('dashboard.refresh', { guildId });
            } catch (err) {
                logger.error('[OwOPipeline] Execution failed:', err);
                eventBus.emit('pipeline.failed', { error: err.message });
            }
        });

        this.initialized = true;
        logger.info(`[OwOPipeline] Pipeline Framework Initialized with ${defaultStages.length} stages.`);
    }

    getPluginApi() {
        return {
            registerStage: (id, instance, metadata) => pipelineRegistry.registerStage(id, instance, metadata),
            executeActivity: async (guildId, userId, activity, payload) => {
                const context = new PipelineContext(guildId, userId, activity, payload);
                await pipelineManager.executePipeline(context);
                return context;
            },
            getHealth: () => pipelineHealth.getHealthScore(),
            getMetrics: () => pipelineHealth.metrics
        };
    }
}

module.exports = new PipelineIntegrationManager();
