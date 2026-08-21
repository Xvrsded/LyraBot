const { Events, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const activeStreamers = new Set();

module.exports = {
    name: Events.PresenceUpdate,
    async execute(oldPresence, newPresence, client) {
        try {
            if (!newPresence || !newPresence.member) return;
            const member = newPresence.member;
            const streamerRoleId = process.env.STREAMER_ROLE_ID;
            const notificationChannelId = process.env.STREAM_NOTIFICATION_CHANNEL_ID;

            if (!streamerRoleId || !notificationChannelId) return;
            if (!member.roles.cache.has(streamerRoleId)) return;

            const isNowStreaming = newPresence.activities.some(activity => activity.type === 1);
            const wasStreaming = oldPresence ? oldPresence.activities.some(activity => activity.type === 1) : false;

            if (isNowStreaming && !activeStreamers.has(member.id)) {
                activeStreamers.add(member.id);
                const streamingActivity = newPresence.activities.find(activity => activity.type === 1);
                
                const channel = await client.channels.fetch(notificationChannelId).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔴 LIVE NOW!')
                        .setDescription(`**${member.user.tag}** sedang live!`)
                        .addFields(
                            { name: '🎮 Game', value: streamingActivity.state || streamingActivity.details || 'Unknown Game', inline: true }
                        )
                        .setColor('#9146FF')
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();

                    if (streamingActivity.url) {
                        embed.addFields({ name: '🔗 Link', value: `[Watch Stream](${streamingActivity.url})`, inline: false });
                    }

                    await channel.send({ content: `<@&${streamerRoleId}> <@${member.id}> sedang live!`, embeds: [embed] }).catch(() => {});
                }
            } else if (!isNowStreaming && activeStreamers.has(member.id)) {
                activeStreamers.delete(member.id);
            }
        } catch (error) {
            logger.error('[PresenceUpdate] Error:', error);
        }
    }
};
