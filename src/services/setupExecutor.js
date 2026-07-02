const setupProgress = require('./setupProgress');
const setupRollback = require('./setupRollback');
const logger = require('../utils/logger');

class SetupExecutor {
    /**
     * Executes the setup actions plan sequentially, maintaining rate-limits, logging progress, and managing rollbacks.
     * @param {Guild} guild Discord Guild object
     * @param {SetupAction[]} plan Array of SetupAction objects
     * @param {object} context Shared execution context
     * @param {object} interaction Discord Interaction object to update progress on
     * @returns {Promise<{ success: boolean, summary: object, rollbackReport: object|null }>}
     */
    async execute(guild, plan, context, interaction) {
        logger.info(`[SetupExecutor] Executing setup plan (${plan.length} actions)...`);
        
        const startTime = Date.now();
        const summary = {
            rolesCreated: 0,
            categoriesCreated: 0,
            channelsCreated: 0,
            objectsDeleted: 0,
            objectsUpdated: 0,
            objectsSkipped: 0,
            errors: [],
            warnings: []
        };

        let completed = 0;
        let lastEditTime = 0;
        let rollbackReport = null;
        let success = true;

        // Progress updates helper with built-in rate-limiting (min 1.5s between edits)
        const updateProgressDisplay = async (actionName, force = false) => {
            const now = Date.now();
            if (force || now - lastEditTime >= 1500) {
                const progressStr = setupProgress.getProgressString(completed, plan.length, actionName);
                await interaction.editReply({ content: progressStr }).catch(err => {
                    logger.warn('[SetupExecutor] Failed to update progress message:', err.message);
                });
                lastEditTime = now;
            }
        };

        for (const action of plan) {
            try {
                // Update live visual progress display before execution
                await updateProgressDisplay(action.name);

                // Queue delay of 250ms between API write tasks to buffer against rate-limits
                await new Promise(r => setTimeout(r, 250));

                logger.debug(`[SetupExecutor] Executing action: "${action.name}"`);
                await action.execute(guild, context);

                // Update summary count based on action results
                if (action.status === 'completed') {
                    if (action.type === 'CREATE_ROLE') summary.rolesCreated++;
                    else if (action.type === 'CREATE_CATEGORY') summary.categoriesCreated++;
                    else if (action.type === 'CREATE_CHANNEL') summary.channelsCreated++;
                    else if (action.type === 'DELETE_ROLE' || action.type === 'DELETE_CHANNEL') summary.objectsDeleted++;
                    else if (action.type === 'UPDATE_PERMISSIONS' || action.type === 'CONFIGURE_DATABASE') summary.objectsUpdated++;
                } else if (action.status === 'skipped') {
                    summary.objectsSkipped++;
                }

                completed++;
            } catch (err) {
                logger.error(`[SetupExecutor] Action failed: "${action.name}" - Error:`, err.message);
                summary.errors.push(`Gagal pada "${action.name}": ${err.message}`);
                success = false;

                // Stop execution and trigger rollback
                try {
                    await interaction.editReply({ content: `❌ **Terjadi Error:** \`${action.name}\` gagal. Menginisiasi rollback otomatis...` });
                    rollbackReport = await setupRollback.executeRollback(guild, context);
                } catch (rollbackErr) {
                    logger.error('[SetupExecutor] Rollback failed to complete:', rollbackErr.message);
                    summary.errors.push(`Rollback Error: ${rollbackErr.message}`);
                }
                break;
            }
        }

        // Final forced progress display edit
        await updateProgressDisplay('Selesai', true);

        const durationSeconds = Math.round((Date.now() - startTime) / 1000);
        summary.setupTime = `${durationSeconds} detik`;

        return {
            success,
            summary,
            rollbackReport
        };
    }
}

module.exports = new SetupExecutor();
