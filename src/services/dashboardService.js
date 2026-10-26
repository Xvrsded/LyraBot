const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DashboardSetting = require('../models/DashboardSetting');
const StoreSetting = require('../models/StoreSetting');
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
            
            // 1. Fetch channel
            const channel = await client.channels.fetch(this.CHANNEL_ID).catch(() => null);
            if (!channel) {
                logger.warn(`[DashboardService Warning] Channel ${this.CHANNEL_ID} tidak ditemukan.`);
                return;
            }

            const guildId = channel.guild.id;

            let doc = await DashboardSetting.findOne({ type: this.TYPE });
            let message = null;
            const storeSetting = await StoreSetting.findOne();

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

            if (!message && storeSetting?.dashboardMessageId &&
                (!storeSetting.dashboardChannelId || storeSetting.dashboardChannelId === this.CHANNEL_ID)) {
                message = await channel.messages.fetch(storeSetting.dashboardMessageId).catch(() => null);
                if (message) {
                    doc = await DashboardSetting.findOneAndUpdate(
                        { type: this.TYPE },
                        {
                            guildId,
                            channelId: this.CHANNEL_ID,
                            messageId: message.id,
                            type: this.TYPE
                        },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );
                    logger.info('[DashboardService] Legacy dashboard message adopted for synchronization.');
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
                await StoreSetting.findOneAndUpdate({}, {
                    dashboardMessageId: newMsg.id,
                    dashboardChannelId: this.CHANNEL_ID
                }, { upsert: true });
                logger.info('[DashboardService] New Dashboard successfully deployed and saved to DB.');
            }

            await StoreSetting.findOneAndUpdate({}, {
                dashboardMessageId: message?.id || doc?.messageId,
                dashboardChannelId: this.CHANNEL_ID
            }, { upsert: true });
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

        await StoreSetting.findOneAndUpdate({}, {
            dashboardMessageId: newMsg.id,
            dashboardChannelId: this.CHANNEL_ID
        }, { upsert: true });

        return newMsg;
    }
}

module.exports = new DashboardService();
