const GuildConfig = require('../models/GuildConfig');
const cacheProvider = require('../utils/cache');
const logger = require('../utils/logger');

class ConfigService {
    /**
     * Initialize/create a configuration document for a guild.
     * @param {string} guildId Guild ID string
     * @returns {Promise<Document>}
     */
    async create(guildId) {
        const config = await GuildConfig.create({ guildId });
        cacheProvider.set(guildId, config);
        logger.info(`[ConfigService] Initialized default GuildConfig for ${guildId}`);
        return config;
    }

    /**
     * Check if configuration document exists in cache or DB.
     * @param {string} guildId Guild ID string
     * @returns {Promise<boolean>}
     */
    async exists(guildId) {
        if (cacheProvider.has(guildId)) return true;
        const count = await GuildConfig.countDocuments({ guildId });
        return count > 0;
    }

    /**
     * Get the GuildConfig document, utilizing cache if hit.
     * @param {string} guildId Guild ID string
     * @returns {Promise<Document>}
     */
    async getConfig(guildId) {
        if (cacheProvider.has(guildId)) {
            return cacheProvider.get(guildId);
        }
        
        let config = await GuildConfig.findOne({ guildId });
        if (!config) {
            config = await this.create(guildId);
        } else {
            cacheProvider.set(guildId, config);
        }
        return config;
    }

    /**
     * Update a specific config path via Mongoose dot notation. Update cache automatically.
     * @param {string} guildId Guild ID string
     * @param {string} path Sub-document path (e.g., 'general.prefix')
     * @param {any} value The new value to store
     * @returns {Promise<Document>}
     */
    async updateConfig(guildId, path, value) {
        const updateQuery = { $set: { [path]: value } };
        const config = await GuildConfig.findOneAndUpdate(
            { guildId },
            updateQuery,
            { new: true, upsert: true }
        );
        cacheProvider.set(guildId, config);
        logger.info(`[ConfigService] Updated Guild ${guildId} config path "${path}" to:`, value);
        return config;
    }

    /**
     * Reset config document to absolute defaults.
     * @param {string} guildId Guild ID string
     * @returns {Promise<Document>}
     */
    async reset(guildId) {
        await GuildConfig.deleteOne({ guildId });
        cacheProvider.delete(guildId);
        const config = await this.create(guildId);
        logger.info(`[ConfigService] Reset configuration to default values for Guild ID: ${guildId}`);
        return config;
    }

    /**
     * Clean up and delete configuration document.
     * @param {string} guildId Guild ID string
     * @returns {Promise<any>}
     */
    async deleteConfig(guildId) {
        const res = await GuildConfig.deleteOne({ guildId });
        cacheProvider.delete(guildId);
        logger.info(`[ConfigService] Deleted configuration document for Guild ID: ${guildId}`);
        return res;
    }

    /**
     * Synchronize DB configurations with all guilds the Discord client is currently in.
     * @param {Client} client Discord Client object
     * @returns {Promise<void>}
     */
    async sync(client) {
        logger.info('[ConfigService] Synchronizing guild configurations...');
        const guilds = client.guilds.cache.keys();
        let createdCount = 0;
        for (const guildId of guilds) {
            const hasConfig = await this.exists(guildId);
            if (!hasConfig) {
                await this.create(guildId);
                createdCount++;
            }
        }
        logger.info(`[ConfigService] Synchronization complete. Registered ${createdCount} missing configs.`);
    }

    /**
     * Expose Cache layer provider.
     * @returns {CacheProvider}
     */
    cache() {
        return cacheProvider;
    }
}

module.exports = new ConfigService();
