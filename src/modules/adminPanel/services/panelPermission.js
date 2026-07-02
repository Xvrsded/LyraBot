const { PermissionsBitField } = require('discord.js');
const logger = require('../../../utils/logger');

class PanelPermission {
    /**
     * Evaluates if a member has permission to view/interact with a panel.
     * @param {GuildMember} member The discord member object.
     * @param {string|Array<string>} requiredPermission The required permission(s).
     * @returns {boolean} True if allowed, false otherwise.
     */
    hasPermission(member, requiredPermission) {
        if (!requiredPermission) return true;

        const perms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

        for (const perm of perms) {
            // Check native Discord permissions
            if (PermissionsBitField.Flags[perm] !== undefined) {
                if (member.permissions.has(PermissionsBitField.Flags[perm])) {
                    return true;
                }
            } 
            
            // Check specific roles (e.g., specific ID or names)
            // Example: 'ROLE_MODERATOR' mapping
            if (perm === 'ADMINISTRATOR' && member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return true;
            }

            // Custom Plugin permissions could be integrated here later via IdentityService
        }

        // If it reaches here, no matching permission was met
        return false;
    }
}

module.exports = new PanelPermission();
