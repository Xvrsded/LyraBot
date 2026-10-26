const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dashboardService = require('../../services/dashboardService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard-init')
        .setDescription('Inisialisasi Dashboard Control Center di channel ini.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            await dashboardService.forceDeploy(interaction);

            return interaction.editReply('✅ Dashboard berhasil diinisialisasi di channel ini.');
        } catch (error) {
            logger.error('[Dashboard-Init] Error:', error);
            return interaction.editReply('❌ Terjadi kesalahan saat menginisialisasi dashboard.');
        }
    },
};
