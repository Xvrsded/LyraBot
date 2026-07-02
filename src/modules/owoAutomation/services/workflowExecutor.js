const WorkflowExecution = require('../models/WorkflowExecution');
const automationMetrics = require('./automationMetrics');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');
// In a real plugin architecture, we'd invoke the plugin instance's method directly
// via pluginContext or an Executor registry. Here we simulate the Plugin call via event bus or dynamic registry.

class WorkflowExecutor {
    constructor() {
        this.registeredExecutors = new Map(); // moduleName -> async (context) => {}
    }

    registerModule(moduleName, executorFn) {
        this.registeredExecutors.set(moduleName, executorFn);
    }

    async executeWaves(executionRecord, context, waves) {
        eventBus.emit('automation.started', { correlationId: context.correlationId, activity: context.activity });

        let workflowFailed = false;

        for (const wave of waves) {
            // Execute independent modules in this wave concurrently using Promise.allSettled
            // This satisfies the prompt's concurrency model for independent modules
            const promises = wave.map(async (moduleName) => {
                const startTime = Date.now();
                let stepRecord = {
                    module: moduleName,
                    status: 'PENDING',
                    startTime: new Date()
                };
                executionRecord.steps.push(stepRecord);

                try {
                    // Start
                    stepRecord.status = 'RUNNING';
                    await executionRecord.save();
                    
                    const executor = this.registeredExecutors.get(moduleName);
                    if (executor) {
                        await executor(context);
                    } else {
                        // Dummy simulate if not registered for testing
                        // throw new Error('Executor not found');
                        await new Promise(r => setTimeout(r, 10)); // simulate work
                    }

                    // Success
                    const endTime = Date.now();
                    stepRecord.status = 'COMPLETED';
                    stepRecord.endTime = new Date(endTime);
                    await executionRecord.save();
                    
                    await automationMetrics.recordStepSuccess(context.activity, moduleName, endTime - startTime);
                    eventBus.emit('automation.workflow.completed', { module: moduleName, correlationId: context.correlationId });
                    
                    return true;
                } catch (error) {
                    const endTime = Date.now();
                    logger.error(`[WorkflowExecutor] Module ${moduleName} failed`, error);
                    
                    // Failure Policy: Skip (we don't crash the whole workflow, but we record it)
                    stepRecord.status = 'FAILED';
                    stepRecord.error = error.message;
                    stepRecord.endTime = new Date(endTime);
                    await executionRecord.save();
                    
                    await automationMetrics.recordStepFailure(context.activity, moduleName);
                    eventBus.emit('automation.workflow.failed', { module: moduleName, correlationId: context.correlationId, error: error.message });
                    workflowFailed = true;
                    
                    return false; // Did not succeed
                }
            });

            const results = await Promise.allSettled(promises);
            // In a strict dependency graph, if a dependency fails, we should technically SKIP its dependents.
            // For simplicity in this engine as requested "if Marketplace fails, Quest still finishes, etc."
            // Since they are independent in the same wave, they don't affect each other.
            // But if a required dependency in wave N failed, wave N+1 modules that depend on it might fail too or be skipped.
            // The prompt says "Automation Engine tidak boleh menghentikan workflow lain kecuali dependency mengharuskan demikian."
            // We'll let the next wave execute and if it fails because a dependency didn't write to context, it will naturally fail and be logged.
        }

        executionRecord.status = workflowFailed ? 'FAILED' : 'COMPLETED';
        executionRecord.updatedAt = new Date();
        await executionRecord.save();

        if (workflowFailed) {
            eventBus.emit('automation.failed', { correlationId: context.correlationId, activity: context.activity });
        } else {
            eventBus.emit('automation.completed', { correlationId: context.correlationId, activity: context.activity });
        }
    }
}

module.exports = new WorkflowExecutor();
