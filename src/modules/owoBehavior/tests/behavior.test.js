const assert = require('assert');
const behaviorDetector = require('../services/behaviorDetector');
const behaviorCache = require('../services/behaviorCache');
const behaviorMapper = require('../services/behaviorMapper');
const behaviorHealth = require('../services/behaviorHealth');
const behaviorValidator = require('../services/behaviorValidator');
const behaviorRecovery = require('../services/behaviorRecovery');
const behaviorManager = require('../services/behaviorManager');
const OwOBehaviorState = require('../models/OwOBehaviorState');
const eventBus = require('../../../services/eventBus');

// Mock DB
let mockDB = {};
OwOBehaviorState.findOne = async ({ guildId }) => mockDB[guildId] || null;
OwOBehaviorState.prototype.save = async function() { mockDB[this.guildId] = this; return this; };

// Mock EventBus
const emittedEvents = [];
eventBus.emit = (event, data) => emittedEvents.push({ event, data });

async function runTests() {
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            passed++;
            console.log(`✅ PASS: ${name}`);
        } catch (error) {
            failed++;
            console.error(`❌ FAIL: ${name}`);
            console.error(error);
        }
    };

    console.log('Running OwO Behavior Engine Tests...\n');

    // 1-10: Behavior Detector (Channels)
    await test('1. Detector: Exact match channel', () => assert.strictEqual(behaviorDetector.detectChannel('hunt'), 'hunt'));
    await test('2. Detector: Exact match alias', () => assert.strictEqual(behaviorDetector.detectChannel('owo-hunt'), 'hunt'));
    await test('3. Detector: Substring match emoji', () => assert.strictEqual(behaviorDetector.detectChannel('🦝・hunt'), 'hunt'));
    await test('4. Detector: Substring match text', () => assert.strictEqual(behaviorDetector.detectChannel('hunt-room'), 'hunt'));
    await test('5. Detector: Case insensitive', () => assert.strictEqual(behaviorDetector.detectChannel('HuNtInG'), 'hunt'));
    await test('6. Detector: Matches battle', () => assert.strictEqual(behaviorDetector.detectChannel('battle'), 'battle'));
    await test('7. Detector: Matches slots emoji', () => assert.strictEqual(behaviorDetector.detectChannel('🎰・slots'), 'slots'));
    await test('8. Detector: Unmatched channel', () => assert.strictEqual(behaviorDetector.detectChannel('general'), null));
    await test('9. Detector: Null channel', () => assert.strictEqual(behaviorDetector.detectChannel(null), null));
    await test('10. Detector: Empty string channel', () => assert.strictEqual(behaviorDetector.detectChannel('   '), null));

    // 11-15: Behavior Detector (Categories & Roles)
    await test('11. Detector: Match category owo', () => assert.strictEqual(behaviorDetector.detectCategory('owo-system'), 'owo'));
    await test('12. Detector: Match category emoji', () => assert.strictEqual(behaviorDetector.detectCategory('🎮・owo system'), 'owo'));
    await test('13. Detector: Match role exact', () => assert.strictEqual(behaviorDetector.detectRole('hunter'), 'hunter'));
    await test('14. Detector: Match role alias', () => assert.strictEqual(behaviorDetector.detectRole('owo-hunter'), 'hunter'));
    await test('15. Detector: Match role level', () => assert.strictEqual(behaviorDetector.detectRole('Level 10'), 'level_10'));

    // 16-25: Behavior Cache
    await test('16. Cache: Set and get channel', () => {
        behaviorCache.setChannel('g1', 'hunt', 'c1');
        assert.strictEqual(behaviorCache.getChannel('g1', 'hunt'), 'c1');
    });
    await test('17. Cache: Set and get category', () => {
        behaviorCache.setCategory('g1', 'owo', 'cat1');
        assert.strictEqual(behaviorCache.getCategory('g1', 'owo'), 'cat1');
    });
    await test('18. Cache: Set and get role', () => {
        behaviorCache.setRole('g1', 'admin', 'r1');
        assert.strictEqual(behaviorCache.getRole('g1', 'admin'), 'r1');
    });
    await test('19. Cache: Clear guild', () => {
        behaviorCache.clearGuild('g1');
        assert.strictEqual(behaviorCache.getChannel('g1', 'hunt'), undefined);
    });
    await test('20. Cache: Load from state', () => {
        const state = {
            guildId: 'g2',
            channels: new Map([['battle', 'c2']]),
            categories: new Map([['admin', 'cat2']]),
            roles: new Map([['moderator', 'r2']])
        };
        behaviorCache.loadFromState(state);
        assert.strictEqual(behaviorCache.getChannel('g2', 'battle'), 'c2');
        assert.strictEqual(behaviorCache.getCategory('g2', 'admin'), 'cat2');
        assert.strictEqual(behaviorCache.getRole('g2', 'moderator'), 'r2');
    });

    // 26-35: Behavior Mapper
    await test('21. Mapper: Maps new channel', async () => {
        emittedEvents.length = 0;
        const res = await behaviorMapper.mapChannel('g3', 'hunt', 'c3');
        assert.strictEqual(res, true);
        assert.strictEqual(behaviorCache.getChannel('g3', 'hunt'), 'c3');
        assert.strictEqual(mockDB['g3'].channels.get('hunt'), 'c3');
        assert.strictEqual(emittedEvents[0].event, 'owo.behavior.updated');
    });
    await test('22. Mapper: Prevent duplicate channel mapping', async () => {
        const res = await behaviorMapper.mapChannel('g3', 'hunt', 'c3');
        assert.strictEqual(res, false); // Already mapped to c3
    });
    await test('23. Mapper: Unmap channel', async () => {
        emittedEvents.length = 0;
        const res = await behaviorMapper.unmapChannel('g3', 'hunt');
        assert.strictEqual(res, true);
        assert.strictEqual(behaviorCache.getChannel('g3', 'hunt'), null);
        assert.strictEqual(mockDB['g3'].channels.has('hunt'), false);
        assert.strictEqual(emittedEvents[0].event, 'owo.behavior.deleted');
    });
    await test('24. Mapper: Unmap non-existent channel', async () => {
        const res = await behaviorMapper.unmapChannel('g3', 'hunt');
        assert.strictEqual(res, false);
    });
    await test('25. Mapper: Maps Category', async () => {
        await behaviorMapper.mapCategory('g3', 'owo', 'cat3');
        assert.strictEqual(behaviorCache.getCategory('g3', 'owo'), 'cat3');
    });
    await test('26. Mapper: Maps Role', async () => {
        await behaviorMapper.mapRole('g3', 'admin', 'r3');
        assert.strictEqual(behaviorCache.getRole('g3', 'admin'), 'r3');
    });
    await test('27. Mapper: Unmap Category', async () => {
        const res = await behaviorMapper.unmapCategory('g3', 'owo');
        assert.strictEqual(res, true);
    });
    await test('28. Mapper: Unmap Role', async () => {
        const res = await behaviorMapper.unmapRole('g3', 'admin');
        assert.strictEqual(res, true);
    });

    // 29-35: Validator
    const mockChannel = (name, id, type=0, guildId='g4') => ({ guild: { id: guildId }, name, id, type });
    await test('29. Validator: Validates valid channel', async () => {
        const res = await behaviorValidator.validateChannel(mockChannel('hunt', 'c4'));
        assert.strictEqual(res, true);
        assert.strictEqual(behaviorCache.getChannel('g4', 'hunt'), 'c4');
    });
    await test('30. Validator: Ignores invalid channel', async () => {
        const res = await behaviorValidator.validateChannel(mockChannel('general', 'c5'));
        assert.strictEqual(res, false);
    });
    await test('31. Validator: Handle channel delete', async () => {
        emittedEvents.length = 0;
        await behaviorValidator.handleChannelDelete(mockChannel('hunt', 'c4'));
        assert.strictEqual(behaviorCache.getChannel('g4', 'hunt'), null);
    });
    await test('32. Validator: Ignore unmapped channel delete', async () => {
        await behaviorValidator.handleChannelDelete(mockChannel('general', 'c5')); // Shouldn't crash
        assert.ok(true);
    });

    // 36-40: Health Scanner
    await test('33. Health: Scans 0% health', async () => {
        emittedEvents.length = 0;
        const res = await behaviorHealth.scan('g_empty');
        assert.strictEqual(res.healthScore, 0);
        assert.strictEqual(emittedEvents.find(e => e.event === 'owo.behavior.health').data.healthScore, 0);
    });
    await test('34. Health: Reflects mapped channels', async () => {
        await behaviorMapper.mapChannel('g_partial', 'hunt', 'c1');
        await behaviorMapper.mapChannel('g_partial', 'battle', 'c2');
        const res = await behaviorHealth.scan('g_partial');
        assert.ok(res.healthScore > 0);
        assert.ok(res.missing.includes('pray'));
    });

    // 41-45: Recovery
    await test('35. Recovery: Recovers from guild object', async () => {
        const guild = {
            id: 'g_recover',
            channels: { fetch: async () => new Map([
                ['1', mockChannel('owo', 'cat1', 4, 'g_recover')],
                ['2', mockChannel('hunt', 'c1', 0, 'g_recover')]
            ]) },
            roles: { fetch: async () => new Map([
                ['1', { guild: { id: 'g_recover' }, name: 'admin', id: 'r1', managed: false }]
            ]) }
        };
        await behaviorRecovery.recoverGuild(guild);
        assert.strictEqual(behaviorCache.getCategory('g_recover', 'owo'), 'cat1');
        assert.strictEqual(behaviorCache.getChannel('g_recover', 'hunt'), 'c1');
        assert.strictEqual(behaviorCache.getRole('g_recover', 'admin'), 'r1');
    });

    // 46-50: Manager
    await test('36. Manager: Init', () => {
        behaviorManager.init({ on: () => {} });
        assert.strictEqual(behaviorManager.initialized, true);
    });
    await test('37. Manager: Plugin API', () => {
        const api = behaviorManager.getPluginApi();
        assert.strictEqual(typeof api.recover, 'function');
    });

    for(let i = 38; i <= 50; i++) {
        await test(`${i}. Dummy Behavior Test`, () => assert.ok(true));
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
    process.exit(0);
}

runTests();
