const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('selfrole')
        .setDescription('Mengelola panel self-role untuk game.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('send')
                .setDescription('Kirim panel self-role ke channel tertentu.')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel tujuan pengiriman panel (default: channel saat ini).')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        if (!targetChannel.isTextBased()) {
            return interaction.reply({ content: '❌ Channel tujuan harus berupa channel teks!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(COLORS.INFO || '#5865f2')
            .setTitle('🎮 Pilihan Peran Game (Self Roles)')
            .setDescription(
                'Dapatkan peran (roles) game Anda untuk membuka akses ke channel diskusi game, mendapatkan notifikasi mabar, dan menemukan teman bermain!\n\n' +
                '**Pilihan Peran Game:**\n\n' +
                '🔥 • **FreeFire**\n' +
                'Role untuk game FreeFire. Bereaksi dengan 🔥 untuk mengambil/melepas peran ini.\n\n' +
                '⚔️ • **Mobile Legend**\n' +
                'Role untuk game Mobile Legends: Bang Bang. Bereaksi dengan ⚔️ untuk mengambil/melepas peran ini.\n\n' +
                '🧱 • **Roblox**\n' +
                'Role untuk game Roblox. Bereaksi dengan 🧱 untuk mengambil/melepas peran ini.\n\n' +
                '⛏️ • **Minecraft**\n' +
                'Role untuk game Minecraft. Bereaksi dengan ⛏️ untuk mengambil/melepas peran ini.\n\n' +
                '🚗 • **GTA V**\n' +
                'Role untuk game GTA V. Bereaksi dengan 🚗 untuk mengambil/melepas peran ini.\n\n' +
                '*Catatan: Bereaksi (React) pada emoji di bawah untuk mengambil peran, hapus reaksi untuk melepas peran. Anda bisa mengambil lebih dari satu peran game.*'
            )
            .setFooter({ text: 'WinterStore Self Roles' })
            .setTimestamp();

        try {
            await interaction.deferReply({ ephemeral: true });
            
            const message = await targetChannel.send({ embeds: [embed] });
            
            // Add reactions sequentially
            const emojis = ['🔥', '⚔️', '🧱', '⛏️', '🚗'];
            for (const emoji of emojis) {
                await message.react(emoji);
            }

            await interaction.editReply({ content: `✅ Panel self-role berhasil dikirim ke ${targetChannel}!` });
        } catch (error) {
            console.error('[SelfRole Command Error]', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: `❌ Gagal mengirim panel self-role: ${error.message}` });
            } else {
                await interaction.reply({ content: `❌ Gagal mengirim panel self-role: ${error.message}`, ephemeral: true });
            }
        }
    }
};
