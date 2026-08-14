const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Order = require('../../models/Order');
const ProductOrder = require('../../models/ProductOrder');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Menampilkan leaderboard pembelian Robux & Produk')
        .addStringOption(option =>
            option.setName('timeframe')
                .setDescription('Pilih rentang waktu leaderboard')
                .setRequired(false)
                .addChoices(
                    { name: 'Semua Waktu', value: 'alltime' },
                    { name: 'Harian', value: 'daily' },
                    { name: 'Minggu Ini', value: 'weekly' },
                    { name: 'Bulan Ini', value: 'monthly' }
                )
        ),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const timeframe = interaction.options.getString('timeframe') || 'alltime';
            const { generateLeaderboardEmbed } = require('../../services/leaderboardHelper');
            const embed = await generateLeaderboardEmbed(interaction.user, timeframe);
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error generating leaderboard:', error);
            await interaction.editReply('❌ Terjadi kesalahan saat memuat leaderboard.');
        }
    }
};
