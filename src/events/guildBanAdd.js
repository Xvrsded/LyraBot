const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const logger = require('../utils/logger');
const processedBans = new Set();

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban, client) {
        try {
            const modChannelId = process.env.MODERATION_NOTIFICATION_CHANNEL_ID;
            if (!modChannelId) return;

            const cacheKey = 'BAN-' + ban.user.id;
            if (processedBans.has(cacheKey)) return;
            processedBans.add(cacheKey);

            setTimeout(() => processedBans.delete(cacheKey), 60000);

            const auditLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
            let moderator = 'Unknown Moderator';
            let reason = ban.reason || 'No reason provided';

            if (auditLogs) {
                const banLog = auditLogs.entries.first();
                if (banLog && banLog.target.id === ban.user.id && banLog.createdTimestamp > Date.now() - 10000) {
                    moderator = `<@${banLog.executor.id}>`;
                    if (banLog.reason) reason = banLog.reason;
                }
            }

            const channel = await client.channels.fetch(modChannelId).catch(() => null);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('🔨 MEMBER BANNED')
                    .addFields(
                        { name: '👤 User', value: `<@${ban.user.id}>`, inline: true },
                        { name: '👮 Moderator', value: moderator, inline: true },
                        { name: '🔨 Action', value: 'Ban', inline: true },
                        { name: '📝 Reason', value: reason, inline: false }
                    )
                    .setColor('#E74C3C')
                    .setTimestamp();
                await channel.send({ embeds: [embed] }).catch(() => {});
            }
        } catch (error) {
            logger.error('[GuildBanAdd] Error processing ban notification:', error);
        }
    }
};
