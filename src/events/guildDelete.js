const { Events } = require('discord.js');
const configService = require('../services/configService');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildDelete,
    
    /**
     * Executes when the bot leaves a guild.
     * @param {Guild} guild Discord Guild object
     * @returns {Promise<void>}
     */
    async execute(guild) {
        try {
            logger.info(`[Event] Bot left guild: ${guild.name} (${guild.id})`);
            await configService.deleteConfig(guild.id);
        } catch (err) {
            logger.error('[guildDelete Event Error]', err);
        }
    }
};
