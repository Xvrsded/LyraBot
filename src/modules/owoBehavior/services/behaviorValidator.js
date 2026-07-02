const behaviorMapper = require('./behaviorMapper');
const behaviorDetector = require('./behaviorDetector');
const behaviorHealth = require('./behaviorHealth');
const logger = require('../../../utils/logger');

class BehaviorValidator {
    /**
     * Re-evaluates a channel when it's updated or created to recover missing mappings.
     */
    async validateChannel(channel) {
        if (!channel || !channel.name || !channel.guild) return false;

        const behaviorId = behaviorDetector.detectChannel(channel.name);
        if (behaviorId) {
            const mapped = await behaviorMapper.mapChannel(channel.guild.id, behaviorId, channel.id);
            if (mapped) await behaviorHealth.scan(channel.guild.id);
            return mapped;
        }
        return false;
    }

    async validateCategory(category) {
        if (!category || !category.name || !category.guild) return false;

        const behaviorId = behaviorDetector.detectCategory(category.name);
        if (behaviorId) {
            return await behaviorMapper.mapCategory(category.guild.id, behaviorId, category.id);
        }
        return false;
    }

    async validateRole(role) {
        if (!role || !role.name || !role.guild) return false;

        const behaviorId = behaviorDetector.detectRole(role.name);
        if (behaviorId) {
            return await behaviorMapper.mapRole(role.guild.id, behaviorId, role.id);
        }
        return false;
    }

    async handleChannelDelete(channel) {
        if (!channel || !channel.guild) return;
        
        // Find if this channel ID was mapped in the DB
        const state = await behaviorMapper._getState(channel.guild.id);
        for (const [behaviorId, mappedId] of state.channels.entries()) {
            if (mappedId === channel.id) {
                logger.warn(`[BehaviorValidator] Channel for behavior '${behaviorId}' was deleted!`);
                await behaviorMapper.unmapChannel(channel.guild.id, behaviorId);
                await behaviorHealth.scan(channel.guild.id);
                break;
            }
        }
        
        // Handle categories too
        if (channel.type === 4) { // GuildCategory
            for (const [behaviorId, mappedId] of state.categories.entries()) {
                if (mappedId === channel.id) {
                    await behaviorMapper.unmapCategory(channel.guild.id, behaviorId);
                    break;
                }
            }
        }
    }

    async handleRoleDelete(role) {
        if (!role || !role.guild) return;

        const state = await behaviorMapper._getState(role.guild.id);
        for (const [behaviorId, mappedId] of state.roles.entries()) {
            if (mappedId === role.id) {
                await behaviorMapper.unmapRole(role.guild.id, behaviorId);
                break;
            }
        }
    }
}

module.exports = new BehaviorValidator();
