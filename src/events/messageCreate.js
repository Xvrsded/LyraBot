const { Events } = require('discord.js');
const owoIntegrationService = require('../services/owoIntegrationService');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageCreate,
    /**
     * Executes when a message is sent. Intercepts OwO bot responses.
     * @param {Message} message Discord Message object
     */
    async execute(message) {
        try {
            await owoIntegrationService.processMessage(message);
        } catch (error) {
            logger.error('[Events: MessageCreate] Failed to process message:', error.message);
        }
    },
};
