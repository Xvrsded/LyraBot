const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { syncVilogPanel } = require('../../services/robuxService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync-vilog')
        .setDescription('Sinkronisasi panel pricelist Robux Via Login ke channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            await syncVilogPanel(interaction.client);
            return interaction.editReply('✅ Panel pricelist Robux Via Login berhasil disinkronisasi!');
        } catch (err) {
            console.error('[Sync Vilog Command Error]', err);
            return interaction.editReply(`❌ Gagal melakukan sinkronisasi panel: ${err.message}`);
        }
    },
};
