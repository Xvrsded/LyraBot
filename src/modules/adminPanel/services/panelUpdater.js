const panelPersistence = require('./panelPersistence');
const panelGenerator = require('./panelGenerator');
const logger = require('../../../utils/logger');
const eventBus = require('../../../services/eventBus');

class PanelUpdater {
    /**
     * Updates an existing admin panel message.
     */
    async updatePanel(client, guildId) {
        try {
            const state = await panelPersistence.getState(guildId);
            if (!state) return false;

            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (!guild) return false;

            const channel = await guild.channels.fetch(state.channelId).catch(() => null);
            if (!channel) return false;

            const message = await channel.messages.fetch(state.messageId).catch(() => null);
            if (!message) return false;

            // Get bot member for permissions context
            const botMember = await guild.members.fetch(client.user.id).catch(() => null);

            const payload = await panelGenerator.generateMainPanel(guild, botMember, state.currentTemplate);
            await message.edit(payload);

            // Update state timestamp
            await panelPersistence.saveState(guildId, state.channelId, state.messageId, state.currentTemplate, state.installedPanels);

            eventBus.emit('panel.updated', { guildId, channelId: channel.id, messageId: message.id });
            logger.info(`[PanelUpdater] Updated admin panel for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`[PanelUpdater] Failed to update panel for guild ${guildId}:`, error);
            return false;
        }
    }
}

module.exports = new PanelUpdater();
