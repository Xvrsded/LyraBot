const AdminPanelState = require('../models/AdminPanelState');
const logger = require('../../../utils/logger');

class PanelPersistence {
    /**
     * Saves or updates the panel state for a guild.
     */
    async saveState(guildId, channelId, messageId, currentTemplate = 'base', installedPanels = []) {
        try {
            const state = await AdminPanelState.findOneAndUpdate(
                { guildId },
                {
                    channelId,
                    messageId,
                    currentTemplate,
                    installedPanels,
                    lastUpdate: Date.now(),
                    recoveryStatus: 'OK'
                },
                { upsert: true, new: true }
            );
            logger.debug(`[PanelPersistence] Saved state for guild ${guildId}`);
            return state;
        } catch (error) {
            logger.error(`[PanelPersistence] Failed to save state for guild ${guildId}:`, error);
            throw error;
        }
    }

    /**
     * Retrieves the panel state for a guild.
     */
    async getState(guildId) {
        try {
            return await AdminPanelState.findOne({ guildId });
        } catch (error) {
            logger.error(`[PanelPersistence] Failed to get state for guild ${guildId}:`, error);
            throw error;
        }
    }

    /**
     * Gets all states (useful for recovery).
     */
    async getAllStates() {
        try {
            return await AdminPanelState.find({});
        } catch (error) {
            logger.error(`[PanelPersistence] Failed to get all states:`, error);
            throw error;
        }
    }

    /**
     * Updates recovery status.
     */
    async setRecoveryStatus(guildId, status) {
        try {
            return await AdminPanelState.findOneAndUpdate(
                { guildId },
                { recoveryStatus: status },
                { new: true }
            );
        } catch (error) {
            logger.error(`[PanelPersistence] Failed to set recovery status for guild ${guildId}:`, error);
            throw error;
        }
    }
}

module.exports = new PanelPersistence();
