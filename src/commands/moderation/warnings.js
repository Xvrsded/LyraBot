const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ModerationCase = require('../../models/ModerationCase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Melihat riwayat warning member.')
        .addUserOption(option => option.setName('user').setDescription('Target member').setRequired(true)),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        try {
            await interaction.deferReply();
            const warnings = await ModerationCase.find({ guildId: interaction.guild.id, targetId: targetUser.id, action: 'WARN' }).sort({ timestamp: -1 });

            if (warnings.length === 0) return interaction.editReply({ content: `✅ <@${targetUser.id}> tidak memiliki warning.` });

            const embed = new EmbedBuilder()
                .setTitle(`Riwayat Warning: ${targetUser.tag}`)
                .setDescription(`Total Warning: **${warnings.length}**`)
                .setColor('#F39C12')
                .setTimestamp();

            warnings.forEach((warn, index) => {
                const date = `<t:${Math.floor(warn.timestamp.getTime() / 1000)}:d>`;
                embed.addFields({
                    name: `Warning #${warnings.length - index}`,
                    value: `**Moderator:** <@${warn.moderatorId}>\n**Alasan:** ${warn.reason}\n**Tanggal:** ${date}`
                });
            });

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[Warnings Command] Error:', error);
            return interaction.editReply({ content: '❌ Terjadi kesalahan saat memuat warning.' });
        }
    }
};
