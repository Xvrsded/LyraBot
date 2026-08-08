const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getStoreSetting, buildDashboardMessage } = require('../../services/storeService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard-init')
        .setDescription('Inisialisasi Dashboard Control Center di channel ini.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const dashboardData = await buildDashboardMessage(interaction.client);
            
            // Send to channel
            const message = await interaction.channel.send(dashboardData);

            // Save to DB
            const setting = await getStoreSetting();
            setting.dashboardMessageId = message.id;
            setting.dashboardChannelId = interaction.channel.id;
            await setting.save();

            return interaction.editReply('✅ Dashboard berhasil diinisialisasi di channel ini.');
        } catch (error) {
            logger.error('[Dashboard-Init] Error:', error);
            return interaction.editReply('❌ Terjadi kesalahan saat menginisialisasi dashboard.');
        }
    },
};
