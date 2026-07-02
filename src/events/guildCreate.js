const { Events } = require('discord.js');
const configService = require('../services/configService');
const panelInstaller = require('../modules/adminPanel/services/panelInstaller');
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

            // 2. Auto-spawn Setup Wizard / Admin Panel on join
            logger.info(`[Event] Auto-spawning Setup Wizard for new guild: ${guild.id}`);
            await panelInstaller.install(guild, 'base');
            
        } catch (err) {
            logger.error('[guildCreate Event Error]', err);
        }
    }
};
