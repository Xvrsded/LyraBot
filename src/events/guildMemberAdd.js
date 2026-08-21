const { Events, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        try {
            const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
            if (welcomeChannelId) {
                const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
                if (welcomeChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🎉 Selamat Datang!')
                        .setDescription(`Halo <@${member.id}>, selamat datang di **${member.guild.name}**!\n\nSilakan baca peraturan server terlebih dahulu di channel verification dan klik tombol **Verify** untuk mendapatkan akses penuh ke server ini.`)
                        .setColor('#3498db')
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();
                    
                    await welcomeChannel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => {});
                }
            }

            const unverifiedRoleId = process.env.UNVERIFIED_ROLE_ID;
            if (unverifiedRoleId) {
                await member.roles.add(unverifiedRoleId).catch(err => {
                    logger.error('[GuildMemberAdd] Failed to add unverified role:', err);
                });
            }
        } catch (error) {
            logger.error('[GuildMemberAdd] Error handling new member:', error);
        }
    }
};
