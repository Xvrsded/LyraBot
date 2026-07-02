require('dotenv').config();
const mongoose = require('mongoose');
const questEngine = require('../services/questEngine');
const eventBus = require('../services/eventBus');
const QuestProgress = require('../models/QuestProgress');
const QuestHistory = require('../models/QuestHistory');
const logger = require('../utils/logger');

// Hook EventBus to capture quest logs
eventBus.subscribe('quest.*', (ctx) => {
    logger.info(`--- [EventBus Capture: Quest] ---`);
    logger.info(`Event: "${ctx.eventName}"`);
    logger.info(`Quest: "${ctx.payload.questId}"`);
    logger.info(`User ID: "${ctx.payload.userId}"`);
    if (ctx.eventName === 'quest.progress') {
        logger.info(`Progress: ${ctx.payload.progress}/${ctx.payload.target}`);
    }
    if (ctx.payload.rewards) {
        logger.info(`Rewards: ${JSON.stringify(ctx.payload.rewards)}`);
    }
});

async function runQuestTests() {
    logger.info('[Test: Quest] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('✅ MongoDB Connected.');

    const testGuildId = '1505187513369624646';
    const testUserId = '1234567890';

    // Clear old test inputs from database
    await QuestProgress.deleteMany({ guildId: testGuildId, userId: testUserId });
    await QuestHistory.deleteMany({ guildId: testGuildId, userId: testUserId });
    logger.info('[Test: Quest] Cleared old test progress documents.');

    // Initialize quest registry & engine
    questEngine.init(null); // Pass null client for testing

    // 1. Simulate 5 Hunt completions
    logger.info('[Test: Quest] Simulating 5 Hunt completions...');
    for (let i = 1; i <= 5; i++) {
        logger.info(`[Test: Quest] Emit owo.hunt.completed #${i}`);
        eventBus.emit('owo.hunt.completed', 
            { petName: 'Raccoon', rank: 'Common' }, 
            { guildId: testGuildId, userId: testUserId }
        );
        // Add small delay to allow async database queries
        await new Promise(r => setTimeout(r, 800));
    }

    // Verify database progress states
    const huntProg = await QuestProgress.findOne({ guildId: testGuildId, userId: testUserId, questId: 'hunt-veteran' });
    logger.info(`[Test: Quest] Hunt progress completed: ${huntProg ? huntProg.completed : 'false'} (Expected: true)`);
    logger.info(`[Test: Quest] Hunt progress claimed: ${huntProg ? huntProg.claimed : 'false'} (Expected: true)`);

    // 2. Simulate 3 Battle won/lost events to check conditions filtering
    logger.info('[Test: Quest] Simulating 3 Battle wins & 1 loss...');
    // Loss (won: false) - should not increment progress
    eventBus.emit('owo.battle.completed', 
        { opponent: 'WinterBot', winner: 'WinterBot', won: false }, 
        { guildId: testGuildId, userId: testUserId }
    );
    await new Promise(r => setTimeout(r, 800));

    // Wins (won: true) - should increment progress
    for (let i = 1; i <= 3; i++) {
        eventBus.emit('owo.battle.completed', 
            { opponent: 'WinterBot', winner: 'Antigravity', won: true }, 
            { guildId: testGuildId, userId: testUserId }
        );
        await new Promise(r => setTimeout(r, 800));
    }

    const battleProg = await QuestProgress.findOne({ guildId: testGuildId, userId: testUserId, questId: 'battle-gladiator' });
    logger.info(`[Test: Quest] Battle progress completed: ${battleProg ? battleProg.completed : 'false'} (Expected: true)`);

    logger.info('[Test: Quest] All Quest tests execution completed successfully.');
    await mongoose.disconnect();
    process.exit(0);
}

runQuestTests().catch(err => {
    logger.error('[Test: Quest] Test failed with error:', err);
    process.exit(1);
});
