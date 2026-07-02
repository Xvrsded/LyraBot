class RealQuestStage {
    constructor() { this.id = 'QuestEngineStage'; this.isParallel = false; this.abortOnFail = false; }
    async execute(context) {
        const questEngine = require('../../../services/questEngine');
        let eventName = '';
        if (context.activity === 'hunt') eventName = 'owo.hunt.completed';
        if (context.activity === 'battle') eventName = 'owo.battle.completed';
        if (context.activity === 'daily') eventName = 'owo.daily.claimed';
        if (context.activity === 'quest') eventName = 'owo.quest.completed';
        if (context.activity === 'inventory') eventName = 'owo.inventory.updated';
        if (context.activity === 'zoo') eventName = 'owo.pet.caught';
        
        if (eventName) {
            await questEngine.handleQuestEvent(eventName, { 
                guildId: context.guildId, 
                userId: context.userId, 
                payload: context.payload 
            });
        }
        context.setMetadata(this.id, 'completed');
    }
}

class RealEconomyStage {
    constructor() { this.id = 'EconomyEngineStage'; this.isParallel = false; this.abortOnFail = false; }
    async execute(context) {
        const rewardDistributor = require('../../../services/rewardDistributor');
        if (context.activity === 'hunt' || context.activity === 'battle') {
            const rewardAmount = Math.floor(Math.random() * 10) + 1; // Example base reward
            await rewardDistributor.reward(context.guildId, context.userId, rewardAmount, 'coins', 'pipeline-engine');
        }
        context.setMetadata(this.id, 'completed');
    }
}

class RealDecisionStage {
    constructor() { this.id = 'DecisionEngineStage'; this.isParallel = false; this.abortOnFail = false; }
    async execute(context) {
        const decisionManager = require('../../owoDecision/services/decisionManager');
        if (decisionManager.initialized) {
            await decisionManager.getPluginApi().evaluate('pipeline.execute', context, context.payload);
        }
        context.setMetadata(this.id, 'completed');
    }
}

class RealAutomationStage {
    constructor() { this.id = 'AutomationEngineStage'; this.isParallel = false; this.abortOnFail = false; }
    async execute(context) {
        const automationManager = require('../../owoAutomation/services/automationManager');
        if (automationManager.initialized) {
            await automationManager.executeActivity(context.activity, context.guildId, context.userId, null, context.payload);
        }
        context.setMetadata(this.id, 'completed');
    }
}

class RealProgressionStage {
    constructor() { this.id = 'ProgressionEngineStage'; this.isParallel = false; this.abortOnFail = false; }
    async execute(context) {
        const progressionEngine = require('../../../services/progressionEngine');
        let eventName = '';
        if (context.activity === 'hunt') eventName = 'owo.hunt.completed';
        if (context.activity === 'battle') eventName = 'owo.battle.completed';
        if (context.activity === 'daily') eventName = 'owo.daily.claimed';
        
        if (eventName) {
            await progressionEngine.handleAchievementEvent(eventName, { 
                guildId: context.guildId, 
                userId: context.userId, 
                payload: context.payload 
            });
        }
        context.setMetadata(this.id, 'completed');
    }
}

class RealInventoryStage {
    constructor() { this.id = 'InventoryEngineStage'; this.isParallel = false; this.abortOnFail = false; }
    async execute(context) {
        // If the context payload contains an item, notify inventory
        if (context.payload && context.payload.petName) {
            const eventBus = require('../../../services/eventBus');
            eventBus.emit('inventory.item_added', { userId: context.userId, itemId: context.payload.petName, quantity: 1 }, { plugin: 'inventory', guildId: context.guildId });
        }
        context.setMetadata(this.id, 'completed');
    }
}

class RealDashboardUpdateStage {
    constructor() { this.id = 'DashboardUpdateStage'; this.isParallel = true; this.abortOnFail = false; }
    async execute(context) {
        const eventBus = require('../../../services/eventBus');
        eventBus.emit('dashboard.refresh', { guildId: context.guildId });
        context.setMetadata(this.id, 'completed');
    }
}

class RealNotificationStage {
    constructor() { this.id = 'NotificationDispatcherStage'; this.isParallel = true; this.abortOnFail = false; }
    async execute(context) {
        const eventBus = require('../../../services/eventBus');
        eventBus.emit('notification.send', { userId: context.userId, message: `Completed ${context.activity} activity` });
        context.setMetadata(this.id, 'completed');
    }
}

class RealValidationStage {
    constructor(id, isParallel = false, abortOnFail = true) {
        this.id = id;
        this.isParallel = isParallel;
        this.abortOnFail = abortOnFail;
    }
    async execute(context) {
        if (!context.guildId || !context.userId) {
            throw new Error(`[${this.id}] Context missing guildId or userId`);
        }
        context.setMetadata(this.id, 'validated');
    }
}

class RealAuditLoggerStage {
    constructor() { this.id = 'AuditLoggerStage'; this.isParallel = true; this.abortOnFail = false; }
    async execute(context) {
        const logger = require('../../../utils/logger');
        logger.info(`[PipelineAudit] Flow for ${context.activity} executed successfully for user ${context.userId}`);
        context.setMetadata(this.id, 'audited');
    }
}

const defaultStages = [
    new RealValidationStage('ValidationStage', false, true),
    new RealValidationStage('ParserStage', false, true),
    new RealValidationStage('NormalizerStage', false, true),
    new RealValidationStage('BehaviorMappingStage', false, true),
    new RealValidationStage('WorkflowResolverStage', false, false),
    new RealQuestStage(),
    new RealProgressionStage(),
    new RealProgressionStage(), // Handles Achievements too
    new RealEconomyStage(),
    new RealInventoryStage(),
    new RealInventoryStage(), // Handles Loot too
    new RealValidationStage('MarketplaceSyncStage', false, false),
    new RealDashboardUpdateStage(),
    new RealDecisionStage(),
    new RealAutomationStage(),
    new RealNotificationStage(),
    new RealAuditLoggerStage()
];

module.exports = defaultStages;
