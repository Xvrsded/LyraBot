const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const configService = require('./configService');
const settingsService = require('./settingsService');
const logger = require('../utils/logger');

class MMRekberService {
    /**
     * Deploys or edits the MM Panel in the designated channel.
     * @param {Client} client 
     */
    async syncMMPanel(client) {
        try {
            const channelId = await settingsService.get('mm_channel_id', '1514305014988800211');
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                logger.warn(`[MM Rekber] Panel channel ${channelId} tidak ditemukan.`);
                return;
            }

            const brandingName = await settingsService.get('branding_name', 'LyraBlox');
            const embed = new EmbedBuilder()
                .setTitle(`🛡️ ${brandingName.toUpperCase()} | MM / REKBER`)
                .setDescription(
                    `Selamat datang di ${brandingName} MM / Rekber.\n` +
                    `Layanan perantara transaksi antara Buyer dan Seller agar transaksi berjalan aman.\nDana akan ditahan sementara oleh ${brandingName} hingga kedua belah pihak menyatakan transaksi selesai.\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📝 **Sistem Transaksi MM**\n` +
                    `• Buyer dan Seller menyetujui transaksi.\n` +
                    `• Buyer mengirimkan dana (termasuk fee MM) ke rekening / e-wallet ${brandingName}.\n` +
                    `• Jika dana sudah masuk, Seller dipersilakan untuk mengirimkan item ke Buyer.\n` +
                    `• Buyer mengkonfirmasi penerimaan item.\n` +
                    `• ${brandingName} meneruskan dana ke Seller (dipotong fee jika ditanggung Seller).\n\n` +
                    `💡 Tekan tombol di bawah untuk menggunakan layanan MM / Rekber.`
                )
                .setColor('#f59e0b')
                .setFooter({ text: `${brandingName} • Last Update: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_mm_order').setLabel('🛡️ Order MM / Rekber').setStyle(ButtonStyle.Primary)
            );

            // Use logic to find previous message and edit, or send new
            try {
                const messages = await channel.messages.fetch({ limit: 50 });
                const oldMessages = messages.filter(m => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === 'btn_mm_order')));
                
                if (oldMessages.size > 0) {
                    const firstMsg = oldMessages.first();
                    await firstMsg.edit({ embeds: [embed], components: [row] });
                    // Delete duplicates if any
                    for (const [id, m] of oldMessages) {
                        if (id !== firstMsg.id) await m.delete().catch(() => {});
                    }
                    logger.info(`[MM Rekber] Panel EDITED in channel: #${channel.name}`);
                } else {
                    await channel.send({ embeds: [embed], components: [row] });
                    logger.info(`[MM Rekber] Panel NEWLY DEPLOYED in channel: #${channel.name}`);
                }
            } catch (err) {
                logger.error('[MM Rekber] Error fetching messages for MM panel:', err);
                await channel.send({ embeds: [embed], components: [row] });
            }
        } catch (err) {
            logger.error('[MM Rekber Service] Error syncing MM panel:', err);
        }
    }

    /**
     * Generates a Select Menu of available MM fees for the order button.
     * Returns the payload to reply to interaction.
     */
    async generateFeeSelectMenu() {
        const config = await configService.getGlobalConfig();
        const mmStatus = config.products?.mm_rekber?.status || 'OPEN';

        if (mmStatus === 'CLOSE') {
            return {
                content: '❌ Store sedang tutup. Mohon tunggu hingga layanan MM kembali dibuka.',
                ephemeral: true
            };
        }

        const fees = await configService.getMMFees();
        if (!fees || fees.length === 0) {
            return {
                content: '❌ Belum ada tarif MM yang tersedia saat ini.',
                ephemeral: true
            };
        }

        const options = fees.map(fee => {
            const minStr = `Rp${fee.minAmount.toLocaleString('id-ID')}`;
            const maxStr = fee.maxAmount >= 999999999 ? 'Ke Atas' : `Rp${fee.maxAmount.toLocaleString('id-ID')}`;
            return {
                label: `${minStr} - ${maxStr}`,
                description: `Fee: Rp${fee.fee.toLocaleString('id-ID')}`,
                value: fee._id.toString()
            };
        });

        const select = new StringSelectMenuBuilder()
            .setCustomId('select_mm_fee')
            .setPlaceholder('Pilih nominal transaksi...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);
        return {
            content: 'Silakan pilih rentang nominal transaksi Anda:',
            components: [row],
            ephemeral: true
        };
    }

    /**
     * Shows a modal after a fee is selected.
     * @param {StringSelectMenuInteraction} interaction 
     */
    async handleFeeSelection(interaction) {
        const feeId = interaction.values[0];
        
        const modal = new ModalBuilder()
            .setCustomId(`modal_mm_order_${feeId}`)
            .setTitle('Form MM / Rekber');

        const buyerInput = new TextInputBuilder()
            .setCustomId('mm_buyer')
            .setLabel('Nama Buyer')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const sellerInput = new TextInputBuilder()
            .setCustomId('mm_seller')
            .setLabel('Nama Seller')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const itemInput = new TextInputBuilder()
            .setCustomId('mm_item')
            .setLabel('Barang / Item Transaksi')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const notesInput = new TextInputBuilder()
            .setCustomId('mm_notes')
            .setLabel('Catatan Tambahan (Opsional)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(buyerInput),
            new ActionRowBuilder().addComponents(sellerInput),
            new ActionRowBuilder().addComponents(itemInput),
            new ActionRowBuilder().addComponents(notesInput)
        );

        await interaction.showModal(modal);
    }
}

module.exports = new MMRekberService();
