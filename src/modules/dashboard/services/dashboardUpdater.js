const DashboardState = require('../models/DashboardState');
const dashboardRenderer = require('../renderer/dashboardRenderer');
const widgetManager = require('./widgetManager');
const logger = require('../../../utils/logger');
const eventBus = require('../../../services/eventBus');

class DashboardUpdater {
    /**
     * Attempts to update a dashboard. Skipped if hash is identical.
     */
    async update(client, state) {
        try {
            const guild = await client.guilds.fetch(state.guildId).catch(() => null);
            if (!guild) return false;

            const channel = await guild.channels.fetch(state.channelId).catch(() => null);
            if (!channel) return false;

            const message = await channel.messages.fetch(state.messageId).catch(() => null);
            if (!message) return false;

            const activeWidgets = widgetManager.resolveWidgets(guild, state.template);
            
            const { payload, hash } = await dashboardRenderer.render(guild, activeWidgets, state.layout);

            // Hash comparison (Performance optimization)
            if (state.hash === hash) {
                // No changes in dynamic data, skip Discord API call
                return true;
            }

            await message.edit(payload);

            // Save new hash and time
            state.hash = hash;
            state.lastRender = Date.now();
            await state.save();

            eventBus.emit('dashboard.updated', { guildId: state.guildId });
            logger.debug(`[DashboardUpdater] Updated dashboard for guild ${state.guildId} (Hash: ${hash.substring(0, 8)})`);
            return true;
        } catch (error) {
            logger.error(`[DashboardUpdater] Error updating dashboard for guild ${state.guildId}:`, error);
            return false;
        }
    }
}

module.exports = new DashboardUpdater();
