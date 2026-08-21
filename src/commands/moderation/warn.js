const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ModerationCase = require('../../models/ModerationCase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Memberikan warning kepada member.')
        .addUserOption(option => option.setName('user').setDescription('Target member').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Alasan warning').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        if (targetUser.bot) return interaction.reply({ content: '❌ Anda tidak dapat memberi warning kepada bot.', ephemeral: true });
        if (targetUser.id === interaction.user.id) return interaction.reply({ content: '❌ Anda tidak dapat memberi warning kepada diri sendiri.', ephemeral: true });

        try {
            await interaction.deferReply();
            const lastCase = await ModerationCase.findOne({ guildId: interaction.guild.id }).sort({ caseNumber: -1 });
            const nextCaseNum = lastCase ? lastCase.caseNumber + 1 : 1;

            await ModerationCase.create({
                guildId: interaction.guild.id,
                caseNumber: nextCaseNum,
                action: 'WARN',
                targetId: targetUser.id,
                targetTag: targetUser.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason: reason,
                correlationId: `WARN-${interaction.guild.id}-${Date.now()}`
            });

            const totalWarnings = await ModerationCase.countDocuments({ guildId: interaction.guild.id, targetId: targetUser.id, action: 'WARN' });

            const modChannelId = process.env.MODERATION_NOTIFICATION_CHANNEL_ID;
            if (modChannelId) {
                const modChannel = await interaction.client.channels.fetch(modChannelId).catch(() => null);
                if (modChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('⚠️ MEMBER WARNED')
                        .addFields(
                            { name: '👤 User', value: `<@${targetUser.id}>`, inline: true },
                            { name: '👮 Moderator', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '⚠️ Action', value: 'Warning', inline: true },
                            { name: '📝 Reason', value: reason, inline: false },
                            { name: '🔢 Total Warnings', value: totalWarnings.toString(), inline: false }
                        )
                        .setColor('#F39C12')
                        .setTimestamp();
                    await modChannel.send({ embeds: [embed] }).catch(() => {});
                }
            }
            return interaction.editReply({ content: `✅ Berhasil memberikan warning kepada <@${targetUser.id}>.` });
        } catch (error) {
            console.error('[Warn Command] Error:', error);
            return interaction.editReply({ content: '❌ Terjadi kesalahan saat memproses warning.' });
        }
    }
};
