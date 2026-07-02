const owoIntegrationService = require('../services/owoIntegrationService');
const eventBus = require('../services/eventBus');
const owoStateManager = require('../services/owoStateManager');
const owoSamples = require('../utils/owo_samples');
const configService = require('../services/configService');
const logger = require('../utils/logger');

// Mock config service to bypass database connection in offline tests
configService.getConfig = async (guildId) => {
    return {
        owo: {
            enabled: true,
            ignoredChannels: []
        }
    };
};

// Mock guild member cache lookup
const mockGuild = {
    id: '1505187513369624646',
    members: {
        cache: [
            { id: '1234567890', user: { username: 'Antigravity' }, displayName: 'Antigravity' }
        ]
    }
};

// Hook EventBus to capture normalization outputs
eventBus.subscribe('owo.*', (ctx) => {
    logger.info(`--- [EventBus Capture] ---`);
    logger.info(`Event: "${ctx.eventName}"`);
    logger.info(`User ID: "${ctx.payload.userId}"`);
    logger.info(`Activity: "${ctx.payload.activity}"`);
    logger.info(`Payload: ${JSON.stringify(ctx.payload.payload)}`);
    logger.info(`CorrelationId: "${ctx.payload.correlationId}"`);
});

// Run async tests
async function runTests() {
    logger.info('[Test] Starting OwO parser validation test suite...');

    // 1. Validate Hunt Parsing
    const huntMsg = {
        ...owoSamples.hunt,
        guild: mockGuild
    };
    logger.info(`[Test] Processing mock Hunt message: "${huntMsg.content}"`);
    await owoIntegrationService.processMessage(huntMsg);

    // Verify cooldown is updated in State Manager
    const huntCooldown = owoStateManager.getCooldown('1234567890', 'hunt');
    logger.info(`[Test] Cooldown hunt remaining: ${huntCooldown}ms (Expected: > 14000ms)`);

    // 2. Validate Battle Parsing
    const battleMsg = {
        ...owoSamples.battle,
        guild: mockGuild
    };
    logger.info(`[Test] Processing mock Battle message: "${battleMsg.content}"`);
    await owoIntegrationService.processMessage(battleMsg);

    // 3. Validate Daily Parsing
    const dailyMsg = {
        ...owoSamples.daily,
        guild: mockGuild
    };
    logger.info(`[Test] Processing mock Daily message: "${dailyMsg.content}"`);
    await owoIntegrationService.processMessage(dailyMsg);

    // 4. Validate Gem Parsing
    const gemMsg = {
        ...owoSamples.gem,
        guild: mockGuild
    };
    logger.info(`[Test] Processing mock Gem message: "${gemMsg.content}"`);
    await owoIntegrationService.processMessage(gemMsg);

    logger.info('[Test] OwO validation test suite execution finished.');
    process.exit(0);
}

runTests();
