const { PermissionFlagsBits } = require('discord.js');

class Validators {
    /**
     * Validate if a channel exists and matches required types.
     * @param {Guild} guild Discord Guild object
     * @param {string} channelId Discord channel ID
     * @param {number[]} [allowedTypes] Array of channel types (e.g. [0] for GuildText)
     * @returns {boolean}
     */
    isValidChannel(guild, channelId, allowedTypes = [0]) {
        if (!channelId) return false;
        const channel = guild.channels.cache.get(channelId);
        if (!channel) return false;
        if (allowedTypes && allowedTypes.length > 0) {
            return allowedTypes.includes(channel.type);
        }
        return true;
    }

    /**
     * Validate if a role exists in the guild.
     * @param {Guild} guild Discord Guild object
     * @param {string} roleId Discord role ID
     * @returns {boolean}
     */
    isValidRole(guild, roleId) {
        if (!roleId) return false;
        return guild.roles.cache.has(roleId);
    }

    /**
     * Validate if the bot has all required permissions in a guild or channel.
     * @param {Guild|GuildChannel} target The target guild or channel
     * @param {bigint[]} permissions Array of permission bits
     * @returns {boolean}
     */
    hasPermissions(target, permissions = []) {
        const clientMember = target.guild?.members.me || target.members?.me;
        if (!clientMember) return false;
        
        // If checking a channel
        if (target.permissionsFor) {
            const botPermissions = target.permissionsFor(clientMember);
            return permissions.every(p => botPermissions.has(p));
        }
        
        // If checking a guild
        return permissions.every(p => clientMember.permissions.has(p));
    }
}

module.exports = new Validators();
