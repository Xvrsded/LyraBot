const MemberIdentity = require('../models/MemberIdentity');
const logger = require('../utils/logger');

class IdentityService {
    /**
     * Saves a leaving member's roles inside MongoDB.
     * @param {GuildMember} member Discord GuildMember object
     * @returns {Promise<void>}
     */
    async saveMemberRoles(member) {
        try {
            // Filter out @everyone and managed/integration roles
            const roles = member.roles.cache
                .filter(r => r.id !== member.guild.id && !r.managed)
                .map(r => r.id);

            await MemberIdentity.findOneAndUpdate(
                { guildId: member.guild.id, userId: member.id },
                {
                    username: member.user.username,
                    previousRoles: roles
                },
                { upsert: true }
            );

            logger.info(`[IdentityService] Saved ${roles.length} roles for leaving member: "${member.user.username}" (${member.id})`);
        } catch (err) {
            logger.error(`[IdentityService] Failed to save roles for member ${member.id}:`, err.message);
        }
    }

    /**
     * Restores previous roles to a rejoined member.
     * @param {GuildMember} member Discord GuildMember object
     * @returns {Promise<number>} Count of roles restored
     */
    async restoreMemberRoles(member) {
        try {
            const identity = await MemberIdentity.findOne({ guildId: member.guild.id, userId: member.id });
            if (!identity || !identity.previousRoles || identity.previousRoles.length === 0) {
                return 0;
            }

            // Filter out roles that no longer exist in the guild, and verify bot hierarchy limits
            const me = member.guild.members.me;
            const validRoles = identity.previousRoles.filter(roleId => {
                const role = member.guild.roles.cache.get(roleId);
                return role && role.comparePositionTo(me.roles.highest) < 0;
            });

            if (validRoles.length > 0) {
                await member.roles.add(validRoles, 'Identity Framework: Role Restore on Rejoin');
                logger.info(`[IdentityService] Restored ${validRoles.length} roles for member "${member.user.username}"`);
                return validRoles.length;
            }
        } catch (err) {
            logger.error(`[IdentityService] Failed to restore roles for member ${member.id}:`, err.message);
        }
        return 0;
    }
}

module.exports = new IdentityService();
