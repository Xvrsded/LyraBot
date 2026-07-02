const questEngine = require('../../../services/questEngine');
const logger = require('../../../utils/logger');

class QuestEngineAdapter {
    async execute(context) {
        // Map Pipeline activity to legacy EventName
        const activity = context.activity;
        let eventName = `owo.${activity}.completed`;
        if (activity === 'daily') eventName = 'owo.daily.claimed';
        if (activity === 'gem') eventName = 'owo.gem.used';
        if (activity === 'inventory') eventName = 'owo.inventory.updated';
        if (activity === 'zoo') eventName = 'owo.pet.caught';
        
        logger.debug(`[QuestAdapter] Forwarding ${activity} to legacy Quest Engine as ${eventName}`);
        await questEngine.handleQuestEvent(eventName, context);
        
        context.setMetadata('QuestAdapter', { executed: true });
    }
}

module.exports = new QuestEngineAdapter();
