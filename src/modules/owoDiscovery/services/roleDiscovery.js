const configMapper = require('./configMapper');
const logger = require('../../../utils/logger');

class RoleDiscovery {
    constructor() {
        // Map of regex patterns to Config keys
        this.rolePatterns = [
            { key: 'roles.admin', pattern: /\badmin(?:istrator)?\b/i },
            { key: 'roles.moderator', pattern: /\bmod(?:erator)?\b/i },
            { key: 'roles.verified', pattern: /\bverified\b/i },
            { key: 'roles.member', pattern: /\bmember\b/i },
            { key: 'roles.vip', pattern: /\bvip\b/i }
        ];
    }

    /**
     * Scans a specific role to see if it matches known patterns.
     */
    async evaluateRole(role) {
        if (!role || !role.name || !role.guild) return false;

        for (const item of this.rolePatterns) {
            if (item.pattern.test(role.name)) {
                logger.debug(`[RoleDiscovery] Matched ${role.name} to ${item.key}`);
                await configMapper.map(role.guild.id, item.key, role.id, role.name);
                return true;
            }
        }
        return false;
    }

    /**
     * Scans all roles in a guild.
     */
    async scanGuild(guild) {
        if (!guild || !guild.roles) return 0;
        
        let mappedCount = 0;
        const roles = await guild.roles.fetch().catch(() => null);
        if (!roles) return 0;

        // Skip @everyone role which has the same ID as guild ID
        for (const [id, role] of roles) {
            if (role && role.id !== guild.id && !role.managed) {
                const mapped = await this.evaluateRole(role);
                if (mapped) mappedCount++;
            }
        }
        return mappedCount;
    }
}

module.exports = new RoleDiscovery();
