const WorkflowExecution = require('../models/WorkflowExecution');
const logger = require('../../../utils/logger');

class AutomationHealth {
    async getHealthScore() {
        try {
            // A simple health score based on the success rate of workflows in the last 24 hours.
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            const total = await WorkflowExecution.countDocuments({ createdAt: { $gte: yesterday } });
            if (total === 0) return 100;

            const failed = await WorkflowExecution.countDocuments({ 
                createdAt: { $gte: yesterday },
                status: 'FAILED'
            });

            const successRate = Math.floor(((total - failed) / total) * 100);
            return successRate;
        } catch (e) {
            logger.error('[AutomationHealth] Failed to calculate health score', e);
            return 100;
        }
    }
}

module.exports = new AutomationHealth();
