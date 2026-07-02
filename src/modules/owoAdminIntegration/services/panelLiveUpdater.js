const PersistentPanel = require('../models/PersistentPanel');
const panelRenderer = require('./panelRenderer');
const panelSessionSync = require('./panelSessionSync');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');

class PanelLiveUpdater {
    constructor() {
        this.updateQueue = new Set();
        this.client = null;
    }

    init(client) {
        this.client = client;
        
        // Throttler loop: updates every 5 seconds
        setInterval(() => this._processUpdates(), 5000);

        // Bind events that should trigger a UI refresh
        const triggerEvents = [
            'configuration.updated',
            'workflow.finished',
            'workflow.failed',
            'quest.completed',
            'achievement.unlocked',
            'economy.transfer',
            'inventory.updated',
            'market.transaction',
            'member.join',
            'member.leave',
            'role.updated',
            'channel.updated',
            'owo.behavior.health',
            'automation.metrics.updated',
            'automation.completed'
        ];

        triggerEvents.forEach(evt => {
            eventBus.subscribe(evt, (data) => {
                if (data && data.guildId) {
                    this.queueUpdate(data.guildId);
                }
            });
        });
    }

    queueUpdate(guildId) {
        this.updateQueue.add(guildId);
    }

    async _processUpdates() {
        if (this.updateQueue.size === 0) return;

        const guildsToUpdate = Array.from(this.updateQueue);
        this.updateQueue.clear();

        for (const guildId of guildsToUpdate) {
            try {
                const panel = await PersistentPanel.findOne({ guildId });
                if (!panel) continue;

                const guild = await this.client.guilds.fetch(guildId).catch(() => null);
                if (!guild) continue;

                const channel = await guild.channels.fetch(panel.channelId).catch(() => null);
                if (!channel) continue;

                const message = await channel.messages.fetch(panel.messageId).catch(() => null);
                if (!message) continue;

                const currentPage = panelSessionSync.getCurrentPage(guildId);
                const payload = await panelRenderer.renderPage(guildId, currentPage);

                await message.edit(payload);
                logger.debug(`[PanelLiveUpdater] Auto-refreshed panel for guild ${guildId}`);
            } catch (e) {
                logger.error(`[PanelLiveUpdater] Failed to process update for guild ${guildId}:`, e);
            }
        }
    }
}

module.exports = new PanelLiveUpdater();
