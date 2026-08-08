const { Events, EmbedBuilder } = require('discord.js');
const owoIntegrationService = require('../services/owoIntegrationService');
const Order = require('../models/Order');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageCreate,
    /**
     * Executes when a message is sent. Intercepts payment proof image uploads in Vilog tickets.
     * @param {Message} message Discord Message object
     */
    async execute(message) {
        // Prevent bot messages from self-triggering
        if (message.author.bot) return;

        try {
            // Process legacy owo integration
            await owoIntegrationService.processMessage(message).catch(() => {});

            // Automatic Payment Proof Image Detection for Ticket Channels
            if (message.channel.name && (message.channel.name.startsWith('vilog-') || message.channel.name.startsWith('visend-') || message.channel.name.startsWith('gig-') || message.channel.name.startsWith('buy-') || message.channel.name.startsWith('mm-') || message.channel.name.startsWith('copay-'))) {
                const orders = await Order.find({ channelId: message.channel.id, status: 'pending' });
                
                if (orders.length > 0 && message.author.id === orders[0].userId) {
                    const hasImage = message.attachments.some(att => {
                        const name = att.name || '';
                        const isImgExt = /\.(png|jpg|jpeg|webp)$/i.test(name);
                        const isImgType = att.contentType && att.contentType.startsWith('image/');
                        return isImgExt || isImgType;
                    });

                    if (hasImage) {
                        // ATOMIC UPDATE: Update all pending orders in this channel
                        const updateResult = await Order.updateMany(
                            { channelId: message.channel.id, status: 'pending' },
                            { $set: { status: 'paid' } }
                        );

                        if (updateResult.modifiedCount === 0) return; // Jika 0, berarti proses lain sudah mengupdate, STOP!

                        // Edit the ticket message panel embed to show "🟢 Paid"
                        try {
                            const messages = await message.channel.messages.fetch({ limit: 50 });
                            const botMsg = messages.find(m => m.author.id === message.client.user.id && m.embeds.length > 0 && m.components.length > 0);
                            
                            if (botMsg) {
                                const oldEmbed = botMsg.embeds[0];
                                const { EmbedBuilder } = require('discord.js');
                                const newEmbed = EmbedBuilder.from(oldEmbed)
                                    .setColor('#00ff00');
                                
                                if (oldEmbed.description) {
                                    const desc = oldEmbed.description;
                                    const updatedDesc = desc.replace(/Status:\s*🟡\s*\*Menunggu Pembayaran\*/i, 'Status: **🟢 Paid**')
                                                           .replace(/Status:\s*🟡\s*Menunggu Pembayaran/i, 'Status: **🟢 Paid**')
                                                           .replace(/🟡 Pending/i, '🟢 Paid')
                                                           .replace(/🟡 Waiting Payment/i, '🟢 Paid');
                                    newEmbed.setDescription(updatedDesc);
                                }
 
                                if (oldEmbed.fields && oldEmbed.fields.length > 0) {
                                    const updatedFields = oldEmbed.fields.map(f => {
                                        if (f.name.toLowerCase().includes('status')) {
                                            return { name: f.name, value: '🟢 Paid', inline: f.inline };
                                        }
                                        return f;
                                    });
                                    newEmbed.setFields(updatedFields);
                                }
 
                                await botMsg.edit({ embeds: [newEmbed] });
                            }
                        } catch (err) {
                            logger.error('[MessageCreate] Failed to edit ticket embed status:', err.message);
                        }

                        // Send success feedback as an Embed to prevent plain text sending
                        const { EmbedBuilder } = require('discord.js');
                        const totalPrice = orders.reduce((sum, o) => sum + o.price, 0);
                        const successEmbed = new EmbedBuilder()
                            .setTitle('✅ Bukti Pembayaran Diterima')
                            .setDescription(
                                `Terima kasih <@${message.author.id}>.\n\n` +
                                `Nominal yang kami terima:\n` +
                                `💰 **Rp ${totalPrice.toLocaleString('id-ID')}**\n\n` +
                                `Status pesanan Anda telah diperbarui menjadi:\n` +
                                `🟢 **Paid**\n\n` +
                                `Staff LyraBlox akan segera memproses pesanan Anda.`
                            )
                            .setColor('#00ff00');

                        await message.reply({ embeds: [successEmbed] });
                    }
                }
            }
        } catch (error) {
            logger.error('[Events: MessageCreate] Failed to process message:', error.message);
        }
    },
};
