const PersistentPanel = require('../models/PersistentPanel');
const panelRenderer = require('./panelRenderer');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

class PanelOrchestrator {
    constructor() {
        this.initialized = false;
        this.client = null;
    }
    init(client) {
        if (this.initialized) return;
        this.client = client;
        logger.info('[OwOAdminIntegration] Initializing Persistent Admin Panel...');
        this.initialized = true;
    }

    async deployPanel(guildId) {
        try {
            const guild = await this.client.guilds.fetch(guildId).catch(() => null);
            if (!guild) return;

            let panel = await PersistentPanel.findOne({ guildId });

            // Ensure Category
            let category = panel && panel.categoryId ? await guild.channels.fetch(panel.categoryId).catch(() => null) : null;
            if (!category) {
                category = await guild.channels.create({
                    name: 'ADMIN',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel],
                        }
                    ]
                });
            }

            // Ensure Channel
            let channel = panel && panel.channelId ? await guild.channels.fetch(panel.channelId).catch(() => null) : null;
            if (!channel) {
                channel = await guild.channels.create({
                    name: 'admin-panel',
                    type: ChannelType.GuildText,
                    parent: category.id
                });
            }

            // Ensure Message
            let message = panel && panel.messageId && channel ? await channel.messages.fetch(panel.messageId).catch(() => null) : null;
            
            const payload = await panelRenderer.renderPage(guildId, 'overview');
            
            if (!message) {
                message = await channel.send(payload);
            } else {
                await message.edit(payload);
            }

            // Save state
            if (!panel) {
                panel = new PersistentPanel({ guildId });
            }
            panel.categoryId = category.id;
            panel.channelId = channel.id;
            panel.messageId = message.id;
            panel.updatedAt = new Date();
            await panel.save();

            logger.info(`[OwOAdminIntegration] Deployed Admin Panel for guild ${guildId}`);
        } catch (error) {
            logger.error(`[OwOAdminIntegration] Failed to deploy panel for guild ${guildId}:`, error);
        }
    }
}

module.exports = new PanelOrchestrator();
