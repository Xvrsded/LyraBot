const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const settingsService = require('./settingsService');
const logger = require('../utils/logger');

// Hardcoded configs based on requirements
const VERIFICATION_CHANNEL_ID = '1537851584246190120';
const VERIFIED_ROLE_ID = '1537781352055967754';

async function syncPanel(client) {
    try {
        const channel = await client.channels.fetch(VERIFICATION_CHANNEL_ID).catch(() => null);
        if (!channel) {
            logger.warn(`[Verification] Channel ${VERIFICATION_CHANNEL_ID} tidak ditemukan.`);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('📜 Server Rules & Verification')
            .setDescription(
                'Selamat datang di server!\n\n' +
                'Sebelum mengakses channel lainnya, silakan baca seluruh rules server.\n\n' +
                'Jika kamu sudah membaca dan menyetujui rules, tekan tombol:\n\n' +
                '✅ **Verify**\n\n' +
                'Setelah berhasil melakukan verification, kamu akan mendapatkan akses ke channel server lainnya.'
            )
            .setColor('#3498db')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify')
                .setLabel('✅ Verify')
                .setStyle(ButtonStyle.Success)
        );

        // Check if message ID is saved in environment variables (for persistence without DB)
        const savedMessageId = process.env.VERIFICATION_MESSAGE_ID || await settingsService.get('verification_panel_msg_id', null);
        
        if (savedMessageId) {
            try {
                const existing = await channel.messages.fetch(savedMessageId);
                if (existing && existing.author.id === client.user.id) {
                    await existing.edit({ embeds: [embed], components: [row] });
                    logger.info(`[Verification] Panel updated via edit() in #${channel.name}`);
                    return;
                }
            } catch (e) {
                // Message not found, let it create a new one
            }
        }

        // Cleanup old verification messages if they exist to prevent duplicates
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const oldMessages = messages.filter(m => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === 'verify')));
            for (const m of oldMessages.values()) {
                await m.delete().catch(() => {});
            }
        } catch (e) {
            // Ignore cleanup errors
        }

        const sent = await channel.send({ embeds: [embed], components: [row] });
        await settingsService.set('verification_panel_msg_id', sent.id);
        
        // Note: For process.env to be persistent across restarts, it would need to be written to the .env file.
        // We use settingsService as the primary persistence layer.
        
        logger.info(`[Verification] Panel created in #${channel.name}`);

    } catch (err) {
        logger.error('[Verification] Error syncing panel:', err);
    }
}

async function handleVerifyButton(interaction) {
    try {
        const member = interaction.member;
        
        if (!member) {
            return interaction.reply({ content: '❌ Terjadi kesalahan saat memverifikasi member.', ephemeral: true });
        }

        // Check if user already has the role
        if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
            return interaction.reply({ content: 'ℹ️ Kamu sudah terverifikasi.', ephemeral: true });
        }

        // Assign role
        await member.roles.add(VERIFIED_ROLE_ID);
        
        return interaction.reply({ content: '✅ Verification berhasil!\n\nKamu sekarang sudah terverifikasi dan dapat mengakses channel server.', ephemeral: true });
    } catch (err) {
        logger.error('[Verification] Error handling verify button:', err);
        return interaction.reply({ content: '❌ Gagal melakukan verifikasi. Pastikan bot memiliki permission yang cukup.', ephemeral: true });
    }
}

module.exports = {
    syncPanel,
    handleVerifyButton,
    VERIFIED_ROLE_ID
};
