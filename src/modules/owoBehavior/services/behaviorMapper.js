const OwOBehaviorState = require('../models/OwOBehaviorState');
const behaviorCache = require('./behaviorCache');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');

class BehaviorMapper {
    async _getState(guildId) {
        let state = await OwOBehaviorState.findOne({ guildId });
        if (!state) {
            state = new OwOBehaviorState({ guildId });
        }
        return state;
    }

    async mapChannel(guildId, behaviorId, channelId) {
        if (!behaviorId || !channelId) return false;
        
        const state = await this._getState(guildId);
        
        // Prevent duplicate mapping if already mapped
        if (state.channels.get(behaviorId) === channelId) return false;

        state.channels.set(behaviorId, channelId);
        await state.save();
        
        behaviorCache.setChannel(guildId, behaviorId, channelId);
        logger.info(`[BehaviorMapper] Mapped channel behavior '${behaviorId}' to ${channelId} in guild ${guildId}`);
        eventBus.emit('owo.behavior.updated', { guildId, type: 'channel', behaviorId, id: channelId });
        return true;
    }

    async unmapChannel(guildId, behaviorId) {
        const state = await this._getState(guildId);
        if (!state.channels.has(behaviorId)) return false;

        state.channels.delete(behaviorId);
        await state.save();
        
        // behaviorCache doesn't have a delete specifically, we can just set to null
        behaviorCache.setChannel(guildId, behaviorId, null);
        logger.info(`[BehaviorMapper] Unmapped channel behavior '${behaviorId}' in guild ${guildId}`);
        eventBus.emit('owo.behavior.deleted', { guildId, type: 'channel', behaviorId });
        return true;
    }

    async mapCategory(guildId, behaviorId, categoryId) {
        if (!behaviorId || !categoryId) return false;
        const state = await this._getState(guildId);
        if (state.categories.get(behaviorId) === categoryId) return false;

        state.categories.set(behaviorId, categoryId);
        await state.save();
        behaviorCache.setCategory(guildId, behaviorId, categoryId);
        logger.info(`[BehaviorMapper] Mapped category behavior '${behaviorId}' to ${categoryId} in guild ${guildId}`);
        eventBus.emit('owo.behavior.updated', { guildId, type: 'category', behaviorId, id: categoryId });
        return true;
    }

    async unmapCategory(guildId, behaviorId) {
        const state = await this._getState(guildId);
        if (!state.categories.has(behaviorId)) return false;

        state.categories.delete(behaviorId);
        await state.save();
        behaviorCache.setCategory(guildId, behaviorId, null);
        eventBus.emit('owo.behavior.deleted', { guildId, type: 'category', behaviorId });
        return true;
    }

    async mapRole(guildId, behaviorId, roleId) {
        if (!behaviorId || !roleId) return false;
        const state = await this._getState(guildId);
        if (state.roles.get(behaviorId) === roleId) return false;

        state.roles.set(behaviorId, roleId);
        await state.save();
        behaviorCache.setRole(guildId, behaviorId, roleId);
        logger.info(`[BehaviorMapper] Mapped role behavior '${behaviorId}' to ${roleId} in guild ${guildId}`);
        eventBus.emit('owo.behavior.updated', { guildId, type: 'role', behaviorId, id: roleId });
        return true;
    }

    async unmapRole(guildId, behaviorId) {
        const state = await this._getState(guildId);
        if (!state.roles.has(behaviorId)) return false;

        state.roles.delete(behaviorId);
        await state.save();
        behaviorCache.setRole(guildId, behaviorId, null);
        eventBus.emit('owo.behavior.deleted', { guildId, type: 'role', behaviorId });
        return true;
    }
}

module.exports = new BehaviorMapper();
