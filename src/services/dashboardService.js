const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DashboardSetting = require('../models/DashboardSetting');
const { buildDashboardMessage } = require('./storeService');
const logger = require('../utils/logger');

class DashboardService {
    constructor() {
        this.CHANNEL_ID = '1534577487852601384';
        this.TYPE = 'control_center';
    }

    /**
     * Synchronize and auto-check dashboard on startup
     * @param {Client} client Discord client
     */
    async syncDashboard(client) {
        try {
            logger.info('[DashboardService] Running startup auto-check...');
            
            // Clean up old master admin panel config
            const Config = require('../models/Config');
            await Config.deleteOne({ key: 'admin_panel_channel_id' }).catch(() => {});
            
            const mongoose = require('mongoose');
            await mongoose.connection.db.dropCollection('adminpanelstates').catch(() => {});
            
            // 1. Fetch channel
            const channel = await client.channels.fetch(this.CHANNEL_ID).catch(() => null);
            if (!channel) {
                logger.warn(`[DashboardService Warning] Channel ${this.CHANNEL_ID} tidak ditemukan.`);
                return;
            }

            const guildId = channel.guild.id;

            // 2. Find dashboard setting in DB
            let doc = await DashboardSetting.findOne({ type: this.TYPE });
            let message = null;

            if (doc) {
                // Check if message still exists in the channel
                message = await channel.messages.fetch(doc.messageId).catch(() => null);
                if (!message) {
                    logger.info('[DashboardService] Message Dashboard tidak ditemukan (mungkin terhapus). Mendeploy ulang...');
                    await DashboardSetting.deleteOne({ _id: doc._id });
                    doc = null;
                } else {
                    logger.info('[DashboardService] Message Dashboard ditemukan. Melakukan update konten...');
                }
            }

            const dashboardPayload = await buildDashboardMessage(client);

            if (message && doc) {
                // Message exists, update it
                await message.edit(dashboardPayload);
                logger.info('[DashboardService] Dashboard successfully updated.');
            } else {
                // Deploy new dashboard
                const newMsg = await channel.send(dashboardPayload);
                await DashboardSetting.create({
                    guildId,
                    channelId: this.CHANNEL_ID,
                    messageId: newMsg.id,
                    type: this.TYPE
                });
                logger.info('[DashboardService] New Dashboard successfully deployed and saved to DB.');
            }
        } catch (error) {
            logger.error('[DashboardService Error] Failed to sync/deploy dashboard:', error);
        }
    }

    /**
     * Force deploy a new dashboard (for slash command setup-dashboard)
     * @param {Interaction} interaction Slash command interaction
     */
    async forceDeploy(interaction) {
        const client = interaction.client;
        const channel = await client.channels.fetch(this.CHANNEL_ID).catch(() => null);
        if (!channel) {
            throw new Error(`Channel ${this.CHANNEL_ID} tidak ditemukan.`);
        }

        // Delete any existing message record and try to delete old message from Discord if possible
        const doc = await DashboardSetting.findOne({ type: this.TYPE });
        if (doc) {
            const oldMsg = await channel.messages.fetch(doc.messageId).catch(() => null);
            if (oldMsg) {
                await oldMsg.delete().catch(() => {});
            }
            await DashboardSetting.deleteOne({ type: this.TYPE });
        }

        const dashboardPayload = await buildDashboardMessage(client);
        const newMsg = await channel.send(dashboardPayload);

        await DashboardSetting.create({
            guildId: channel.guild.id,
            channelId: this.CHANNEL_ID,
            messageId: newMsg.id,
            type: this.TYPE
        });

        return newMsg;
    }
}

module.exports = new DashboardService();
