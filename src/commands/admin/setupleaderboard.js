const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const leaderboardService = require('../../services/leaderboardService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupleaderboard')
        .setDescription('Setup atau Force Sync Leaderboard Top Spender')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            await interaction.editReply('🔄 Memulai sinkronisasi Transaction Log... Mohon tunggu.');
            
            // Panggil fungsi sinkronisasi (yang otomatis akan melakukan updateLeaderboard juga di akhir)
            await leaderboardService.syncTransactionLogs(client);

            await interaction.editReply('✅ Sinkronisasi selesai! Leaderboard telah diperbarui.');
        } catch (error) {
            console.error('[SetupLeaderboard] Error:', error);
            await interaction.editReply('❌ Terjadi kesalahan saat sinkronisasi Leaderboard.');
        }
    },
};
