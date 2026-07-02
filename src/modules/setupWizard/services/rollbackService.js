const logger = require('../../../utils/logger');

class RollbackService {
    async rollback(state) {
        logger.info(`[SetupWizard] Initiating Rollback for ${state.guildId}...`);

        const { roles, categories, channels } = state.rollbackData;

        // Mocking deletion of channels
        for (const ch of channels) {
            logger.debug(`[SetupWizard] Rolling back channel ${ch}`);
            // await discordApi.deleteChannel(ch);
        }

        for (const cat of categories) {
            logger.debug(`[SetupWizard] Rolling back category ${cat}`);
            // await discordApi.deleteChannel(cat);
        }

        for (const role of roles) {
            logger.debug(`[SetupWizard] Rolling back role ${role}`);
            // await discordApi.deleteRole(role);
        }

        // Clear rollback data
        state.rollbackData = { roles: [], categories: [], channels: [] };
        state.progress = 0;
        state.status = 'idle';

        logger.info(`[SetupWizard] Rollback completed for ${state.guildId}.`);
    }
}

module.exports = new RollbackService();
