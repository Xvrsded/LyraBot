const { ChannelType, PermissionFlagsBits } = require('discord.js');
const panelPersistence = require('./panelPersistence');
const panelGenerator = require('./panelGenerator');
const logger = require('../../../utils/logger');
const eventBus = require('../../../services/eventBus');

class PanelInstaller {
    /**
     * Installs the Admin Panel to a specific guild.
     * Creates the Administration category, admin-panel channel, and posts the UI.
     */
    async install(guild, template = 'base') {
        try {
            // Check if already installed in DB
            const existingState = await panelPersistence.getState(guild.id);
            if (existingState) {
                // Trigger updater instead
                const updater = require('./panelUpdater');
                const updated = await updater.updatePanel(guild.client, guild.id);
                if (updated) return true;
                // If update failed (e.g. channel deleted), proceed to recreate below
            }

            // Create Category
            let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'administration');
            if (!category) {
                category = await guild.channels.create({
                    name: 'Administration',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: guild.client.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels]
                        }
                        // Note: Bot Owner / Admins implicitly bypass via ADMINISTRATOR flag
                    ]
                });
            }

            // Create admin-panel channel
            let adminChannel = guild.channels.cache.find(c => c.parentId === category.id && c.name === 'admin-panel');
            if (!adminChannel) {
                adminChannel = await guild.channels.create({
                    name: 'admin-panel',
                    type: ChannelType.GuildText,
                    parent: category.id
                });
            }

            // Clear old messages in this channel just in case
            const messages = await adminChannel.messages.fetch({ limit: 50 }).catch(() => null);
            if (messages) {
                for (const [, msg] of messages) {
                    if (msg.author.id === guild.client.user.id) {
                        await msg.delete().catch(() => {});
                    }
                }
            }

            const botMember = await guild.members.fetch(guild.client.user.id).catch(() => null);
            const payload = await panelGenerator.generateMainPanel(guild, botMember, template);
            
            const message = await adminChannel.send(payload);

            // Save state
            await panelPersistence.saveState(guild.id, adminChannel.id, message.id, template, []);

            eventBus.emit('panel.installed', { guildId: guild.id, channelId: adminChannel.id, messageId: message.id });
            logger.info(`[PanelInstaller] Installed admin panel for guild ${guild.id}`);
            return true;
        } catch (error) {
            logger.error(`[PanelInstaller] Failed to install panel for guild ${guild.id}:`, error);
            return false;
        }
    }
}

module.exports = new PanelInstaller();
