const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ModerationCase = require('../../models/ModerationCase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('Menghapus semua warning dari member.')
        .addUserOption(option => option.setName('user').setDescription('Target member').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        try {
            await interaction.deferReply();
            const result = await ModerationCase.deleteMany({ guildId: interaction.guild.id, targetId: targetUser.id, action: 'WARN' });

            if (result.deletedCount === 0) return interaction.editReply({ content: `ℹ️ <@${targetUser.id}> tidak memiliki warning untuk dihapus.` });
            return interaction.editReply({ content: `🗑️ Berhasil menghapus **${result.deletedCount}** warning dari <@${targetUser.id}>.` });
        } catch (error) {
            console.error('[ClearWarnings Command] Error:', error);
            return interaction.editReply({ content: '❌ Terjadi kesalahan saat menghapus warning.' });
        }
    }
};
