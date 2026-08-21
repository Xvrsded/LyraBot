const { Events, EmbedBuilder, GuildScheduledEventStatus } = require('discord.js');
const logger = require('../utils/logger');
const notifiedEvents = new Set();

module.exports = {
    name: Events.GuildScheduledEventUpdate,
    async execute(oldEvent, newEvent, client) {
        try {
            const eventChannelId = process.env.EVENT_NOTIFICATION_CHANNEL_ID;
            if (!eventChannelId) return;

            const isNowActive = newEvent.status === GuildScheduledEventStatus.Active;
            const wasActive = oldEvent ? oldEvent.status === GuildScheduledEventStatus.Active : false;

            if (isNowActive && !wasActive && !notifiedEvents.has(newEvent.id)) {
                notifiedEvents.add(newEvent.id);
                const channel = await client.channels.fetch(eventChannelId).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🎉 SERVER EVENT IS LIVE!')
                        .setDescription(`Event **${newEvent.name}** sudah dimulai!\n\nJangan sampai ketinggalan!`)
                        .setColor('#F1C40F')
                        .setTimestamp();

                    if (newEvent.description) embed.addFields({ name: '📝 Deskripsi', value: newEvent.description });
                    const location = newEvent.entityMetadata?.location || (newEvent.channelId ? `<#${newEvent.channelId}>` : 'Unknown Location');
                    embed.addFields({ name: '📍 Location', value: location });

                    if (newEvent.url) embed.addFields({ name: '🔗 Join Event', value: `[Klik di sini](${newEvent.url})` });
                    if (newEvent.coverImageURL()) embed.setImage(newEvent.coverImageURL({ size: 512 }));

                    await channel.send({ content: `@everyone Event **${newEvent.name}** dimulai!`, embeds: [embed] }).catch(() => {});
                }
            } else if (newEvent.status === GuildScheduledEventStatus.Completed || newEvent.status === GuildScheduledEventStatus.Canceled) {
                notifiedEvents.delete(newEvent.id);
            }
        } catch (error) {
            logger.error('[GuildScheduledEventUpdate] Error:', error);
        }
    }
};
