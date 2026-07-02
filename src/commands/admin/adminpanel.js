const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getAdminPanelEmbed } = require('../../services/adminService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminpanel')
        .setDescription('Sistem Master Admin Panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Deploy/Generate Panel Admin Utama di channel ini')
        ),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            try {
                const panelPayload = await getAdminPanelEmbed(interaction.client, interaction.guild);
                await interaction.channel.send(panelPayload);
                return interaction.editReply('✅ Master Admin Panel berhasil dideploy di channel ini!');
            } catch (err) {
                console.error('[Admin Command Error]', err);
                return interaction.editReply(`❌ Gagal mendeploy panel: ${err.message}`);
            }
        }
    },
};
