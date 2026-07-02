const { Events } = require('discord.js');
const onboardingManager = require('../services/onboardingManager');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberAdd,
    /**
     * Executes when a new member joins the guild. Passes execution to the onboardingManager.
     * @param {GuildMember} member Discord GuildMember
     */
    async execute(member) {
        try {
            await onboardingManager.handleMemberJoin(member);
        } catch (error) {
            logger.error('[Events: GuildMemberAdd] Failed to process onboarding:', error);
        }
    },
};
