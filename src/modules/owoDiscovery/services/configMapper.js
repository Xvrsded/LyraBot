const configService = require('../../../services/configService');
const logger = require('../../../utils/logger');
// Normally we'd use audit service if available, otherwise just use logger.
const auditLogger = logger; // fallback

class ConfigMapper {
    /**
     * Maps a discovered entity (channel/role) to the ConfigService.
     * @param {string} guildId 
     * @param {string} key Configuration key (e.g., 'owo.mainChannel')
     * @param {string} id The Snowflake ID of the channel/role
     * @param {string} entityName Used for logging (e.g., 'owo channel')
     */
    async map(guildId, key, id, entityName) {
        try {
            const existing = await configService.get(guildId, key);
            // Overwrite Policy: If already exists and is different, we overwrite 
            // since the discovery engine found the "best match" based on templates.
            if (existing === id) return false; // Already mapped correctly

            await configService.set(guildId, key, id);
            
            logger.info(`[ConfigMapper] Mapped ${key} to ${entityName} (${id}) in guild ${guildId}`);
            
            // Audit Log
            if (auditLogger.audit) {
                auditLogger.audit(`Auto-Discovery mapped ${key} to ${id}`, guildId);
            }
            
            return true;
        } catch (error) {
            logger.error(`[ConfigMapper] Failed to map ${key} for guild ${guildId}:`, error);
            return false;
        }
    }

    /**
     * Unmaps a key (used when a channel is deleted).
     */
    async unmap(guildId, key) {
        try {
            const existing = await configService.get(guildId, key);
            if (!existing) return false;

            await configService.delete(guildId, key);
            logger.info(`[ConfigMapper] Unmapped ${key} in guild ${guildId}`);
            
            if (auditLogger.audit) {
                auditLogger.audit(`Auto-Discovery unmapped ${key}`, guildId);
            }

            return true;
        } catch (error) {
            logger.error(`[ConfigMapper] Failed to unmap ${key} for guild ${guildId}:`, error);
            return false;
        }
    }
}

module.exports = new ConfigMapper();
