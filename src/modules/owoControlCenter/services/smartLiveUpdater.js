const crypto = require('crypto');
const logger = require('../../../utils/logger');
// Mock dependency to original panelLiveUpdater, assuming we wrap it.
// Here we just provide the smart hash logic.
const originalUpdater = require('../../owoAdminIntegration/services/panelLiveUpdater');
const PersistentPanel = require('../../owoAdminIntegration/models/PersistentPanel');
const panelRenderer = require('../../owoAdminIntegration/services/panelRenderer');
const panelSessionSync = require('../../owoAdminIntegration/services/panelSessionSync');

class SmartLiveUpdater {
    constructor() {
        this.hashCache = new Map();
        this.updateQueue = new Set();
        this.client = null;
    }

    init(client) {
        this.client = client;
        setInterval(() => this._processUpdates(), 5000);
        
        // Hijack the queue mechanism of original updater to use smart hashing
        originalUpdater.queueUpdate = (guildId) => {
            this.updateQueue.add(guildId);
        };
    }

    _hashPayload(payload) {
        const str = JSON.stringify(payload, (key, val) => 
            // Filter out timestamp changes from embed to avoid false positives
            key === 'timestamp' ? undefined : val
        );
        return crypto.createHash('md5').update(str).digest('hex');
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
                
                const newHash = this._hashPayload(payload);
                const oldHash = this.hashCache.get(`${guildId}:${currentPage}`);

                if (newHash !== oldHash) {
                    await message.edit(payload);
                    this.hashCache.set(`${guildId}:${currentPage}`, newHash);
                    logger.debug(`[SmartLiveUpdater] Auto-refreshed panel for guild ${guildId} (Hash diff triggered)`);
                } else {
                    logger.debug(`[SmartLiveUpdater] Skipped update for guild ${guildId} (Hash identical)`);
                }
            } catch (e) {
                logger.error(`[SmartLiveUpdater] Failed to process update for guild ${guildId}:`, e);
            }
        }
    }
}

module.exports = new SmartLiveUpdater();
