const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const logger = require('../utils/logger');
const processedTimeouts = new Set();

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        try {
            const modChannelId = process.env.MODERATION_NOTIFICATION_CHANNEL_ID;
            if (!modChannelId) return;

            if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
                const timeoutUntil = newMember.communicationDisabledUntil;
                const cacheKey = `TIMEOUT-${newMember.id}-${timeoutUntil.getTime()}`;
                
                if (processedTimeouts.has(cacheKey)) return;
                processedTimeouts.add(cacheKey);
                setTimeout(() => processedTimeouts.delete(cacheKey), 60000);

                const auditLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate }).catch(() => null);
                let moderator = 'Unknown Moderator';
                let reason = 'No reason provided';

                if (auditLogs) {
                    const timeoutLog = auditLogs.entries.first();
                    if (timeoutLog && timeoutLog.target.id === newMember.id && timeoutLog.createdTimestamp > Date.now() - 10000) {
                        if (timeoutLog.changes.some(change => change.key === 'communication_disabled_until')) {
                            moderator = `<@${timeoutLog.executor.id}>`;
                            reason = timeoutLog.reason || 'No reason provided';
                        }
                    }
                }

                const durationMs = timeoutUntil.getTime() - Date.now();
                const durationMinutes = Math.round(durationMs / 60000);

                const channel = await client.channels.fetch(modChannelId).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔨 MEMBER TIMEOUT')
                        .addFields(
                            { name: '👤 User', value: `<@${newMember.id}>`, inline: true },
                            { name: '👮 Moderator', value: moderator, inline: true },
                            { name: '🔨 Action', value: 'Timeout', inline: true },
                            { name: '⏱️ Duration', value: `${durationMinutes} minutes`, inline: true },
                            { name: '📝 Reason', value: reason, inline: false }
                        )
                        .setColor('#E67E22')
                        .setTimestamp();
                    await channel.send({ embeds: [embed] }).catch(() => {});
                }
            }
        } catch (error) {
            logger.error('[GuildMemberUpdate] Error processing timeout notification:', error);
        }
    }
};
