const PersistentPanel = require('../models/PersistentPanel');
const panelOrchestrator = require('./panelOrchestrator');
const logger = require('../../../utils/logger');

class PanelRecovery {
    init(client) {
        client.on('messageDelete', async (message) => {
            if (!message.guild) return;
            const panel = await PersistentPanel.findOne({ guildId: message.guild.id });
            if (panel && panel.messageId === message.id) {
                logger.warn(`[PanelRecovery] Admin Panel message deleted in guild ${message.guild.id}! Redeploying...`);
                // Nullify message so orchestrator recreates it
                panel.messageId = null;
                await panel.save();
                await panelOrchestrator.deployPanel(message.guild.id);
            }
        });

        client.on('channelDelete', async (channel) => {
            if (!channel.guild) return;
            const panel = await PersistentPanel.findOne({ guildId: channel.guild.id });
            if (panel && panel.channelId === channel.id) {
                logger.warn(`[PanelRecovery] Admin Panel channel deleted in guild ${channel.guild.id}! Redeploying...`);
                panel.channelId = null;
                panel.messageId = null;
                await panel.save();
                await panelOrchestrator.deployPanel(channel.guild.id);
            }
        });
    }
}

module.exports = new PanelRecovery();
