const behaviorValidator = require('./behaviorValidator');
const behaviorHealth = require('./behaviorHealth');
const OwOBehaviorState = require('../models/OwOBehaviorState');
const logger = require('../../../utils/logger');

class BehaviorRecovery {
    /**
     * Runs a full scan across the entire guild to map everything and recover lost links.
     */
    async recoverGuild(guild) {
        if (!guild) return;
        logger.info(`[BehaviorRecovery] Running full recovery scan on guild ${guild.id}...`);

        let state = await OwOBehaviorState.findOne({ guildId: guild.id });
        if (!state) {
            state = new OwOBehaviorState({ guildId: guild.id });
            await state.save();
        }

        // Channels & Categories
        const channels = await guild.channels.fetch().catch(() => null);
        if (channels) {
            for (const [id, channel] of channels) {
                if (!channel) continue;
                if (channel.type === 4) { // GuildCategory
                    await behaviorValidator.validateCategory(channel);
                } else if (channel.type === 0 || channel.type === 2) { // GUILD_TEXT or GUILD_VOICE
                    await behaviorValidator.validateChannel(channel);
                }
            }
        }

        // Roles
        const roles = await guild.roles.fetch().catch(() => null);
        if (roles) {
            for (const [id, role] of roles) {
                if (role && role.id !== guild.id && !role.managed) {
                    await behaviorValidator.validateRole(role);
                }
            }
        }

        await behaviorHealth.scan(guild.id);
        logger.info(`[BehaviorRecovery] Recovery scan completed for guild ${guild.id}`);
    }
}

module.exports = new BehaviorRecovery();
