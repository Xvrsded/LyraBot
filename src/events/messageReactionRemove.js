const { Events } = require('discord.js');
const logger = require('../utils/logger');

const GAME_ROLES = {
    '🔥': '1524498485368328263', // FreeFire
    '⚔️': '1524498170384617522', // Mobile Legend
    '🧱': '1524498854068879490', // Roblox
    '⛏️': '1524498941943742525', // Minecraft
    '🚗': '1524499078401228860'  // GTA V
};

const TARGET_CHANNEL_ID = '1524501253886050344';

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user, client) {
        // Ignore reactions from bots
        if (user.bot) return;

        // Only process reactions in the target channel
        if (reaction.message.channelId !== TARGET_CHANNEL_ID) return;

        // Fetch partial reaction / message if necessary
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                logger.error('[Events: MessageReactionRemove] Failed to fetch partial reaction:', error);
                return;
            }
        }

        const emoji = reaction.emoji.name;
        const roleId = GAME_ROLES[emoji];

        // If the emoji doesn't correspond to any role, ignore it
        if (!roleId) return;

        try {
            const guild = reaction.message.guild;
            if (!guild) return;

            // Fetch member
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                logger.warn(`[Events: MessageReactionRemove] Member with ID ${user.id} not found in guild.`);
                return;
            }

            // Remove role
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                logger.info(`[Events: MessageReactionRemove] Removed role ${roleId} from ${member.user.tag}`);
                
                // Optionally DM user
                try {
                    await member.send(`➖ Peran game **${emoji}** telah dihapus dari profil Anda di **${guild.name}**.`);
                } catch (dmErr) {
                    // Ignore DM errors (user may have DMs closed)
                }
            }
        } catch (error) {
            logger.error(`[Events: MessageReactionRemove] Error removing role ${roleId} from user ${user.id}:`, error);
        }
    }
};
