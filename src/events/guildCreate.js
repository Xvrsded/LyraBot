const { Events } = require('discord.js');
const configService = require('../services/configService');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildCreate,
    
    /**
     * Executes when the bot joins a new guild.
     * @param {Guild} guild Discord Guild object
     * @returns {Promise<void>}
     */
    async execute(guild) {
        try {
            logger.info(`[Event] Bot joined new guild: ${guild.name} (${guild.id})`);
            
            // 1. Fetch initial configuration
            await configService.getConfig(guild.id);


            
        } catch (err) {
            logger.error('[guildCreate Event Error]', err);
        }
    }
};
