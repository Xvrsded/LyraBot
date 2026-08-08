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
            const config = await configService.getConfig(guildId);
            const existing = config.get ? config.get(key) : null;
            
            // Overwrite Policy: If already exists and is different, we overwrite 
            // since the discovery engine found the "best match" based on templates.
            if (existing === id) return false; // Already mapped correctly

            await configService.updateConfig(guildId, key, id);
            
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

    async unmap(guildId, key) {
        try {
            const config = await configService.getConfig(guildId);
            const existing = config.get ? config.get(key) : null;
            if (!existing) return false;

            await configService.updateConfig(guildId, key, null);
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
