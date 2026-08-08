const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { syncVisendPanel } = require('../../services/robuxService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync-visend')
        .setDescription('Sinkronisasi panel pricelist Robux Via Send ke channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            await syncVisendPanel(interaction.client);
            return interaction.editReply('✅ Panel pricelist Robux Via Send berhasil disinkronisasi!');
        } catch (err) {
            console.error('[Sync Visend Command Error]', err);
            return interaction.editReply(`❌ Gagal melakukan sinkronisasi panel: ${err.message}`);
        }
    },
};
