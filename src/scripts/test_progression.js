require('dotenv').config();
const mongoose = require('mongoose');
const progressionEngine = require('../services/progressionEngine');
const eventBus = require('../services/eventBus');
const MemberProgression = require('../models/MemberProgression');
const AchievementProgress = require('../models/AchievementProgress');
const logger = require('../utils/logger');

// Hook EventBus to capture progression updates
eventBus.subscribe('achievement.unlocked', (ctx) => {
    logger.info(`--- [EventBus: Achievement Unlocked] ---`);
    logger.info(`User: "${ctx.payload.userId}" unlocked achievement "${ctx.payload.achievementId}" (+${ctx.payload.points} pts)`);
});

eventBus.subscribe('title.unlocked', (ctx) => {
    logger.info(`👑 Title Unlocked: [${ctx.payload.title}] for User ${ctx.payload.userId}`);
});

eventBus.subscribe('badge.earned', (ctx) => {
    logger.info(`📛 Badge Earned: "${ctx.payload.badge}" for User ${ctx.payload.userId}`);
});

eventBus.subscribe('progression.level_up', (ctx) => {
    logger.info(`⚡ Level Up! User ${ctx.payload.userId} is now Level ${ctx.payload.level}`);
});

async function runProgressionTests() {
    logger.info('[Test: Progression] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('✅ MongoDB Connected.');

    const testGuildId = '1505187513369624646';
    const testUserId = '1234567890';

    // Clear old test records
    await MemberProgression.deleteMany({ guildId: testGuildId, userId: testUserId });
    await AchievementProgress.deleteMany({ guildId: testGuildId, userId: testUserId });
    logger.info('[Test: Progression] Cleared old test database entries.');

    // Initialize progression engine
    progressionEngine.init(null);

    // 1. Simulate 10 Hunt completions to trigger Hunt Master achievement and XP levels
    logger.info('[Test: Progression] Simulating 10 Hunt completions...');
    for (let i = 1; i <= 10; i++) {
        logger.info(`[Test: Progression] Emit owo.hunt.completed #${i}`);
        eventBus.emit('owo.hunt.completed', 
            { petName: 'Raccoon', rank: 'Common' }, 
            { guildId: testGuildId, userId: testUserId }
        );
        await new Promise(r => setTimeout(r, 600));
    }

    // 2. Simulate 3 Quest completions to trigger Quest Champion achievement
    logger.info('[Test: Progression] Simulating 3 Quest completions...');
    for (let i = 1; i <= 3; i++) {
        logger.info(`[Test: Progression] Emit quest.completed #${i}`);
        eventBus.emit('quest.completed', 
            { questId: 'dummy-quest' }, 
            { guildId: testGuildId, userId: testUserId }
        );
        await new Promise(r => setTimeout(r, 600));
    }

    // Output final DB document status
    const prog = await MemberProgression.findOne({ guildId: testGuildId, userId: testUserId });
    logger.info('--- Final Database Progression Record ---');
    logger.info(`Level: ${prog ? prog.level : 1}`);
    logger.info(`XP: ${prog ? prog.xp : 0}`);
    logger.info(`Achievement Points: ${prog ? prog.achievementPoints : 0}`);
    logger.info(`Titles Unlocked: ${prog ? JSON.stringify(prog.titles) : '[]'}`);
    logger.info(`Badges Earned: ${prog ? JSON.stringify(prog.badges) : '[]'}`);

    logger.info('[Test: Progression] All Progression validation tests finished.');
    await mongoose.disconnect();
    process.exit(0);
}

runProgressionTests().catch(err => {
    logger.error('[Test: Progression] Critical test crash:', err);
    process.exit(1);
});
