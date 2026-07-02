const OwOBehaviorState = require('../models/OwOBehaviorState');
const channelBehaviors = require('../registry/channelBehaviors.json');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');

class BehaviorHealth {
    /**
     * Calculates health based on core channels.
     * We don't require EVERY single channel for 100%, but we require core ones.
     */
    constructor() {
        this.coreBehaviors = Object.keys(channelBehaviors); // For full enterprise we expect 100% match of the template
    }

    async scan(guildId) {
        let state = await OwOBehaviorState.findOne({ guildId });
        if (!state) {
            state = new OwOBehaviorState({ guildId });
        }

        let validCount = 0;
        let missing = [];

        for (const behavior of this.coreBehaviors) {
            if (state.channels.has(behavior)) {
                validCount++;
            } else {
                missing.push(behavior);
            }
        }

        const score = Math.floor((validCount / this.coreBehaviors.length) * 100);
        
        state.healthScore = score;
        state.missingBehaviors = missing;
        state.lastScan = new Date();
        await state.save();

        if (score < 100) {
            logger.warn(`[BehaviorHealth] Guild ${guildId} health is ${score}%. Missing ${missing.length} core behaviors.`);
        } else {
            logger.info(`[BehaviorHealth] Guild ${guildId} health is 100%.`);
        }

        eventBus.emit('owo.behavior.health', { guildId, healthScore: score, missing });
        return { healthScore: score, missing };
    }
}

module.exports = new BehaviorHealth();
