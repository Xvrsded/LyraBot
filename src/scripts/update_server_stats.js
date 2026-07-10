const { ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');

const STATS_CONFIG = [
    { emoji: '🌐', key: 'all', label: 'All Members' },
    { emoji: '🤡', key: 'members', label: 'Members' },
    { emoji: '🤖', key: 'bots', label: 'Bots' },
    { emoji: '⚠️', key: 'channels', label: 'Channels' },
    { emoji: '🎭', key: 'roles', label: 'Roles' }
];

async function updateServerStats(client) {
    const guildId = '1524497086572396737'; // Target Server ID

    try {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            logger.warn(`[Stats Tracker] Guild with ID ${guildId} not found.`);
            return;
        }

        // Fetch all members to populate cache and get accurate bot/human counts
        const members = await guild.members.fetch();
        const botsCount = members.filter(m => m.user.bot).size;
        const membersCount = members.filter(m => !m.user.bot).size;
        const allCount = members.size;
        
        // Count channels (excluding categories)
        const channelsCount = guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).size;
        
        // Count roles
        const rolesCount = guild.roles.cache.size;

        const stats = {
            all: allCount,
            members: membersCount,
            bots: botsCount,
            channels: channelsCount,
            roles: rolesCount
        };

        // Find or create category
        let category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name.includes('SERVER STATS')
        );

        if (!category) {
            category = await guild.channels.create({
                name: '📊 SERVER STATS 📊',
                type: ChannelType.GuildCategory,
                position: 0,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.Connect],
                        allow: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            });
            logger.info('[Stats Tracker] Created category "📊 SERVER STATS 📊"');
        } else {
            // Ensure category is at the top (position 0)
            if (category.position !== 0) {
                await category.setPosition(0).catch(() => null);
            }
        }

        // Find or create voice channels under category
        const voiceChannels = guild.channels.cache.filter(
            c => c.parentId === category.id && c.type === ChannelType.GuildVoice
        );

        for (const config of STATS_CONFIG) {
            const expectedName = `${config.emoji} ${config.label}: ${stats[config.key]}`;
            
            // Find existing channel by emoji prefix
            let channel = voiceChannels.find(c => c.name.startsWith(config.emoji));

            if (!channel) {
                channel = await guild.channels.create({
                    name: expectedName,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.Connect],
                            allow: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
                logger.info(`[Stats Tracker] Created stats channel: "${expectedName}"`);
            } else {
                // If it exists, update the name if it is different
                if (channel.name !== expectedName) {
                    await channel.setName(expectedName);
                    logger.info(`[Stats Tracker] Updated stats channel: "${channel.name}" -> "${expectedName}"`);
                }
                
                // Ensure channel is under the category and has correct permissions
                if (channel.parentId !== category.id) {
                    await channel.setParent(category.id);
                }
            }
        }
    } catch (error) {
        logger.error('[Stats Tracker] Error updating server stats:', error);
    }
}

function startServerStatsTracker(client) {
    // Run every 10 minutes (600,000 ms)
    const INTERVAL = 10 * 60 * 1000;

    // Run once on startup (wait 10 seconds for ready state to stabilize)
    setTimeout(() => {
        logger.info('[Stats Tracker] Running initial server stats setup...');
        updateServerStats(client);
    }, 10000);

    // Schedule periodic updates
    setInterval(() => {
        logger.info('[Stats Tracker] Running periodic server stats update...');
        updateServerStats(client);
    }, INTERVAL);
}

module.exports = { startServerStatsTracker, updateServerStats };
