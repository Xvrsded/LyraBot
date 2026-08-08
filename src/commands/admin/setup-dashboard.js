const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const dashboardService = require('../../services/dashboardService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-dashboard')
        .setDescription('Deploy ulang dashboard LyraBlox Control Center.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Permission check: Only Owner and Administrators
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isOwner = interaction.guild.ownerId === interaction.user.id;
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isOwner && !isAdmin) {
            return interaction.reply({ content: '❌ Hanya Owner dan Administrator yang dapat menggunakan command ini.', ephemeral: true });
        }

        try {
            await dashboardService.forceDeploy(interaction);
            return interaction.editReply('✅ Dashboard LyraBlox Control Center berhasil dideploy ulang!');
        } catch (error) {
            logger.error('[Setup-Dashboard Command Error]', error);
            return interaction.editReply(`❌ Gagal mendeploy ulang dashboard: ${error.message}`);
        }
    },
};
