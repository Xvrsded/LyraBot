const WorkflowExecution = require('../models/WorkflowExecution');
const logger = require('../../../utils/logger');
// Note: Normally would import workflowExecutor but to avoid circular dep we will let Manager handle the reboot
// or just export a flag to find stale ones.

class AutomationRecovery {
    async recoverStaleWorkflows() {
        try {
            // Find workflows that are still marked as RUNNING but haven't been updated in 10 minutes
            const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
            
            const staleExecutions = await WorkflowExecution.find({
                status: 'RUNNING',
                updatedAt: { $lt: tenMinsAgo }
            });

            if (staleExecutions.length > 0) {
                logger.warn(`[AutomationRecovery] Found ${staleExecutions.length} stale workflow executions. Marking as FAILED.`);
                for (const exec of staleExecutions) {
                    exec.status = 'FAILED';
                    exec.updatedAt = new Date();
                    
                    // Mark any RUNNING steps as FAILED
                    for (const step of exec.steps) {
                        if (step.status === 'RUNNING') {
                            step.status = 'FAILED';
                            step.error = 'Stale execution recovered';
                        }
                    }
                    
                    await exec.save();
                }
            }
        } catch (e) {
            logger.error('[AutomationRecovery] Failed to recover stale workflows', e);
        }
    }
}

module.exports = new AutomationRecovery();
