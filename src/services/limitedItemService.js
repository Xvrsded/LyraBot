const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const StoreSetting = require('../models/StoreSetting');
const configService = require('./configService');
const logger = require('../utils/logger');
const auditService = require('./auditService');

// As per user request, this is the hardcoded channel ID for Limited Item panel
const LIMITED_CHANNEL_ID = '1534576257147211916';

class LimitedItemService {
    /**
     * Deploys or updates the Limited Item Panel in the configured channel.
     * @param {import('discord.js').Client} client 
     */
    async syncLimitedPanel(client) {
        try {
            const channel = await client.channels.fetch(LIMITED_CHANNEL_ID).catch(() => null);
            if (!channel) {
                logger.warn(`[Limited Item] Channel ${LIMITED_CHANNEL_ID} not found. Cannot sync panel.`);
                return;
            }

            const config = await configService.getGlobalConfig();
            
            // Generate Embed
            const timeString = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
            
            const embed = new EmbedBuilder()
                .setColor('#00bfff')
                .setDescription(
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `💎 **Limited Item Roblox**\n\n` +
                    `Ingin membeli Limited Roblox?\n` +
                    `Silakan buat Ticket melalui tombol di bawah.\n\n` +
                    `Karena harga Limited selalu berubah mengikuti market serta stock seller,\n` +
                    `harga akan diinput langsung saat membuat pesanan.\n\n` +
                    `Pastikan data yang dimasukkan sudah benar.\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📌 **Informasi**\n\n` +
                    `• Harga mengikuti market.\n` +
                    `• Harga diinput manual ketika membuat order.\n` +
                    `• Pastikan nama item benar.\n` +
                    `• Setelah Ticket dibuat harga tidak dapat diubah.\n` +
                    `• Staff akan melakukan pengecekan sebelum transaksi diproses.\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `*Last Update:*\n` +
                    `*Today at ${timeString}*`
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_limited_order')
                    .setLabel('Order Limited Item')
                    .setEmoji('💎')
                    .setStyle(ButtonStyle.Primary)
            );

            // Check if message exists
            const messageId = config.panelMessageIds?.LIMITED;
            if (messageId) {
                const existingMsg = await channel.messages.fetch(messageId).catch(() => null);
                if (existingMsg) {
                    await existingMsg.edit({ embeds: [embed], components: [row] });
                    logger.info('[Limited Item] Panel EDITED in channel: #' + channel.name);
                    return;
                }
            }

            // Create new message if not exists
            const newMsg = await channel.send({ embeds: [embed], components: [row] });
            
            // Save to DB
            await StoreSetting.updateOne(
                { _id: config._id },
                { $set: { 'panelMessageIds.LIMITED': newMsg.id } }
            );
            
            logger.info('[Limited Item] Panel NEWLY DEPLOYED in channel: #' + channel.name);

        } catch (error) {
            logger.error('[Limited Item] Error syncing panel:', error);
        }
    }
}

module.exports = new LimitedItemService();
