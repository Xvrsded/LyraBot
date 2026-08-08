const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Product = require('../../models/Product');
const settingsService = require('../../services/settingsService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync-panels')
        .setDescription('Sinkronisasi panel pembelian produk ke masing-masing channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const activeProducts = await Product.find({ active: true });
            if (activeProducts.length === 0) {
                return interaction.editReply('⚠️ Tidak ada produk aktif di database untuk disinkronisasi.');
            }

            let successCount = 0;
            let errorCount = 0;
            const logChannelInfo = [];

            for (const product of activeProducts) {
                if (!product.channelId) {
                    logChannelInfo.push(`🔸 **${product.name}**: Channel ID belum disetel.`);
                    errorCount++;
                    continue;
                }

                const channel = await interaction.guild.channels.fetch(product.channelId).catch(() => null);
                if (!channel) {
                    logChannelInfo.push(`❌ **${product.name}**: Channel <#${product.channelId}> tidak ditemukan.`);
                    errorCount++;
                    continue;
                }

                // Clean up previous messages sent by this bot containing this product's buy button
                try {
                    const messages = await channel.messages.fetch({ limit: 50 });
                    const oldMessages = messages.filter(m => 
                        m.author.id === interaction.client.user.id && 
                        m.components.some(row => 
                            row.components.some(c => c.customId === `buy_product_${product._id}`)
                        )
                    );
                    for (const m of oldMessages.values()) {
                        await m.delete().catch(() => {});
                    }
                } catch (err) {
                    logger.warn(`Failed to clean up old messages in channel ${product.channelId}:`, err.message);
                }

                // Build Embed
                const embed = new EmbedBuilder()
                    .setTitle(product.embed.title || product.name)
                    .setDescription(product.embed.description || product.description)
                    .setColor(product.embed.color || '#0099ff')
                    .setFooter({ text: product.embed.footer || 'LyraBlox Store' })
                    .setTimestamp();

                if (product.embed.thumbnail) {
                    embed.setThumbnail(product.embed.thumbnail);
                }
                if (product.embed.banner) {
                    embed.setImage(product.embed.banner);
                }

                // Add fields summarizing price if PER_ROBUX
                if (product.pricingType === 'PER_ROBUX') {
                    embed.addFields({ name: '💎 Rate Payout', value: `Rp ${product.price.toLocaleString('id-ID')} / Robux` });
                } else {
                    embed.addFields({ name: '💵 Harga', value: `Rp ${product.price.toLocaleString('id-ID')}` });
                }

                // Build Button
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`buy_product_${product._id}`)
                        .setLabel(product.button.label || 'Beli')
                        .setEmoji(product.button.emoji || '🛒')
                        .setStyle(ButtonStyle.Success)
                );

                await channel.send({ embeds: [embed], components: [row] });
                logChannelInfo.push(`✅ **${product.name}** -> <#${product.channelId}>`);
                successCount++;
            }

            const description = `**Sinkronisasi Selesai!**\n\n` +
                                `• Sukses: **${successCount}**\n` +
                                `• Gagal/Terlewati: **${errorCount}**\n\n` +
                                `**Detail:**\n${logChannelInfo.join('\n')}`;

            return interaction.editReply(description);
        } catch (err) {
            logger.error('[Sync Panels Command] Error syncing product panels:', err);
            return interaction.editReply(`❌ Gagal melakukan sinkronisasi panel: ${err.message}`);
        }
    },
};
