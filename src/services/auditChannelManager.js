const configService = require('./configService');
const logger = require('../utils/logger');

class AuditChannelManager {
    /**
     * Resolves the target Discord channel ID for an audit action based on guild configuration.
     * @param {Guild} guild Discord Guild object
     * @param {object} entry Raw audit entry data
     * @returns {Promise<string|null>} Resolved channel ID or null
     */
    async resolveChannelId(guild, entry) {
        try {
            const config = await configService.getConfig(guild.id);
            const { action, plugin } = entry;

            // 1. Route based on Action types
            if (['BAN', 'KICK', 'WARN', 'TIMEOUT', 'SOFTBAN', 'MUTE', 'UNMUTE', 'UNBAN'].includes(action)) {
                return config.channels?.logs || null; // Moderation Logs
            }

            if (action === 'MEMBER_JOIN') {
                return config.channels?.welcome || null; // Join Logs
            }

            if (action === 'MEMBER_LEAVE') {
                return config.channels?.goodbye || config.channels?.welcome || null; // Leave Logs
            }

            if (action.startsWith('ROLE_')) {
                return config.channels?.logs || null; // Role Logs
            }

            if (action.startsWith('SETUP_') || action.startsWith('TEMPLATE_')) {
                return config.channels?.logs || null; // Setup Logs
            }

            if (action.startsWith('CONFIG_')) {
                return config.channels?.logs || null; // Configuration Logs
            }

            if (plugin === 'scheduler' || action.startsWith('JOB_')) {
                return config.channels?.logs || null; // Scheduler Logs
            }

            // Fallback default logs channel
            return config.channels?.logs || null;
        } catch (err) {
            logger.error('[AuditChannelManager] Failed to resolve channel:', err.message);
            return null;
        }
    }
}

module.exports = new AuditChannelManager();
