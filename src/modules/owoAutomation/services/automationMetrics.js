const WorkflowStatistics = require('../models/WorkflowStatistics');
const logger = require('../../../utils/logger');

class AutomationMetrics {
    async recordStepSuccess(activity, moduleName, executionTimeMs) {
        try {
            await WorkflowStatistics.updateOne(
                { module: moduleName, activity },
                { 
                    $inc: { 
                        executions: 1, 
                        successes: 1,
                        totalExecutionTimeMs: executionTimeMs,
                        slowExecutions: executionTimeMs > 1000 ? 1 : 0
                    } 
                },
                { upsert: true }
            );
        } catch (e) {
            logger.error(`[AutomationMetrics] Failed to record success for ${moduleName}`, e);
        }
    }

    async recordStepFailure(activity, moduleName) {
        try {
            await WorkflowStatistics.updateOne(
                { module: moduleName, activity },
                { $inc: { executions: 1, failures: 1 } },
                { upsert: true }
            );
        } catch (e) {
            logger.error(`[AutomationMetrics] Failed to record failure for ${moduleName}`, e);
        }
    }

    async recordStepRetry(activity, moduleName) {
        try {
            await WorkflowStatistics.updateOne(
                { module: moduleName, activity },
                { $inc: { retries: 1 } },
                { upsert: true }
            );
        } catch (e) {
            logger.error(`[AutomationMetrics] Failed to record retry for ${moduleName}`, e);
        }
    }

    async getStatistics() {
        return await WorkflowStatistics.find({}).lean();
    }
}

module.exports = new AutomationMetrics();
