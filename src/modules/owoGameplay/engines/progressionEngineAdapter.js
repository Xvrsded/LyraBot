const progressionEngine = require('../../../services/progressionEngine');
const logger = require('../../../utils/logger');

class ProgressionEngineAdapter {
    async execute(context) {
        // Map Pipeline activity to legacy EventName
        const activity = context.activity;
        let eventName = `owo.${activity}.completed`;
        if (activity === 'daily') eventName = 'owo.daily.claimed';
        if (activity === 'gem') eventName = 'owo.gem.used';
        if (activity === 'inventory') eventName = 'owo.inventory.updated';
        if (activity === 'zoo') eventName = 'owo.pet.caught';

        logger.debug(`[ProgressionAdapter] Forwarding ${activity} to legacy Progression Engine as ${eventName}`);
        await progressionEngine.handleAchievementEvent(eventName, context);
        
        context.setMetadata('ProgressionAdapter', { executed: true });
    }
}

module.exports = new ProgressionEngineAdapter();
