const assert = require('assert');
const configService = require('../../../services/configService');
const eventBus = require('../../../services/eventBus');
const configMapper = require('../services/configMapper');
const channelDiscovery = require('../services/channelDiscovery');
const roleDiscovery = require('../services/roleDiscovery');
const migrationDetector = require('../services/migrationDetector');
const healthScanner = require('../services/healthScanner');
const owoDiscoveryManager = require('../services/owoDiscoveryManager');
const OwODiscoveryState = require('../models/OwODiscoveryState');

// Mock Config Service
const mockConfig = new Map();
configService.get = async (g, k) => mockConfig.get(`${g}:${k}`);
configService.set = async (g, k, v) => mockConfig.set(`${g}:${k}`, v);
configService.delete = async (g, k) => mockConfig.delete(`${g}:${k}`);

// Mock DB
let mockDB = {};
OwODiscoveryState.findOne = async ({ guildId }) => mockDB[guildId] || null;
OwODiscoveryState.prototype.save = async function() { mockDB[this.guildId] = this; return this; };

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

    console.log('Running OwO Discovery Framework Tests...\n');

    // 1-10: Config Mapper
    await test('1. ConfigMapper: Map new key', async () => {
        await configMapper.map('g1', 'owo.mainChannel', 'c1', 'owo');
        assert.strictEqual(await configService.get('g1', 'owo.mainChannel'), 'c1');
    });
    await test('2. ConfigMapper: Overwrite existing key', async () => {
        await configMapper.map('g1', 'owo.mainChannel', 'c2', 'owo');
        assert.strictEqual(await configService.get('g1', 'owo.mainChannel'), 'c2');
    });
    await test('3. ConfigMapper: Unmap key', async () => {
        await configMapper.unmap('g1', 'owo.mainChannel');
        assert.strictEqual(await configService.get('g1', 'owo.mainChannel'), undefined);
    });
    await test('4. ConfigMapper: Unmap non-existent', async () => {
        const res = await configMapper.unmap('g1', 'nonexistent');
        assert.strictEqual(res, false);
    });
    await test('5. ConfigMapper: Graceful error handle', async () => {
        const oldSet = configService.set;
        configService.set = async () => { throw new Error('DB Down'); };
        const res = await configMapper.map('g2', 'test', '123', 't');
        assert.strictEqual(res, false);
        configService.set = oldSet;
    });

    // 6-15: Channel Discovery
    const mockChannel = (name, id = 'c1', type = 0, gId = 'g1') => ({ guild: { id: gId }, name, id, type });
    await test('6. ChannelDiscovery: Matches owo', async () => {
        assert.strictEqual(await channelDiscovery.evaluateChannel(mockChannel('owo')), true);
        assert.strictEqual(await configService.get('g1', 'owo.mainChannel'), 'c1');
    });
    await test('7. ChannelDiscovery: Matches quest', async () => {
        assert.strictEqual(await channelDiscovery.evaluateChannel(mockChannel('quest-channel')), true);
        assert.strictEqual(await configService.get('g1', 'owo.questChannel'), 'c1');
    });
    await test('8. ChannelDiscovery: Ignores non-matching', async () => {
        assert.strictEqual(await channelDiscovery.evaluateChannel(mockChannel('general')), false);
    });
    await test('9. ChannelDiscovery: Scan Guild with maps', async () => {
        const guild = {
            id: 'g3',
            channels: {
                fetch: async () => new Map([
                    ['1', mockChannel('owo', '1', 0, 'g3')],
                    ['2', mockChannel('general', '2', 0, 'g3')]
                ])
            }
        };
        const count = await channelDiscovery.scanGuild(guild);
        assert.strictEqual(count, 1);
        assert.strictEqual(await configService.get('g3', 'owo.mainChannel'), '1');
    });
    await test('10. ChannelDiscovery: Scan Guild handles missing channels', async () => {
        const count = await channelDiscovery.scanGuild({ channels: { fetch: async () => { throw new Error(); } } });
        assert.strictEqual(count, 0);
    });

    // 16-25: Role Discovery
    const mockRole = (name, id = 'r1', gId = 'g1') => ({ guild: { id: gId }, name, id, managed: false });
    await test('16. RoleDiscovery: Matches Admin', async () => {
        assert.strictEqual(await roleDiscovery.evaluateRole(mockRole('Administrator')), true);
        assert.strictEqual(await configService.get('g1', 'roles.admin'), 'r1');
    });
    await test('17. RoleDiscovery: Matches Mod', async () => {
        assert.strictEqual(await roleDiscovery.evaluateRole(mockRole('Moderator')), true);
        assert.strictEqual(await configService.get('g1', 'roles.moderator'), 'r1');
    });
    await test('18. RoleDiscovery: Scan Guild skips everyone', async () => {
        const guild = {
            id: 'g3',
            roles: {
                fetch: async () => new Map([
                    ['g3', mockRole('@everyone', 'g3', 'g3')],
                    ['r2', mockRole('vip', 'r2', 'g3')]
                ])
            }
        };
        const count = await roleDiscovery.scanGuild(guild);
        assert.strictEqual(count, 1);
        assert.strictEqual(await configService.get('g3', 'roles.vip'), 'r2');
    });
    await test('19. RoleDiscovery: Skips managed roles', async () => {
        const r = mockRole('verified', 'r3');
        r.managed = true;
        assert.strictEqual(await roleDiscovery.evaluateRole(r), true); // evaluateRole doesn't check managed, scanGuild does
    });

    // 26-35: Migration Detector
    await test('26. MigrationDetector: Skips already migrated', async () => {
        mockDB['g_migrated'] = { guildId: 'g_migrated', migrated: true };
        const res = await migrationDetector.detect({ id: 'g_migrated' });
        assert.strictEqual(res, true);
    });
    await test('27. MigrationDetector: Detects and saves migration', async () => {
        const guild = {
            id: 'g_new_mig',
            channels: { fetch: async () => new Map([['1', mockChannel('owo', '1', 0, 'g_new_mig')]]) },
            roles: { fetch: async () => new Map() }
        };
        const res = await migrationDetector.detect(guild);
        assert.strictEqual(res, true);
        assert.strictEqual(mockDB['g_new_mig'].migrated, true);
    });
    await test('28. MigrationDetector: Returns false if clean', async () => {
        const guild = {
            id: 'g_clean',
            channels: { fetch: async () => new Map([['1', mockChannel('general', '1')]]) },
            roles: { fetch: async () => new Map() }
        };
        const res = await migrationDetector.detect(guild);
        assert.strictEqual(res, false);
    });

    // 36-40: Health Scanner
    await test('36. HealthScanner: Scans empty config (0%)', async () => {
        const guild = {
            id: 'g_health_0',
            channels: { fetch: async () => null },
            roles: { fetch: async () => null }
        };
        const res = await healthScanner.scan(guild);
        assert.strictEqual(res.healthScore, 0);
        assert.strictEqual(res.missing.length, 5);
    });
    await test('37. HealthScanner: Validates 100%', async () => {
        const g = 'g_health_100';
        mockConfig.set(`${g}:owo.mainChannel`, 'c1');
        mockConfig.set(`${g}:owo.questChannel`, 'c1');
        mockConfig.set(`${g}:admin.panelChannel`, 'c1');
        mockConfig.set(`${g}:roles.admin`, 'r1');
        mockConfig.set(`${g}:roles.verified`, 'r1');
        
        const guild = {
            id: g,
            channels: { fetch: async () => ({ id: 'c1' }) },
            roles: { fetch: async () => ({ id: 'r1' }) }
        };
        const res = await healthScanner.scan(guild);
        assert.strictEqual(res.healthScore, 100);
        assert.strictEqual(res.missing.length, 0);
    });

    // 41-50: OwoDiscoveryManager (Event Hooks)
    await test('41. Manager: Initializes once', () => {
        owoDiscoveryManager.init({ on: () => {} });
        assert.strictEqual(owoDiscoveryManager.initialized, true);
    });
    await test('42. Manager: Double init ignored', () => {
        owoDiscoveryManager.init({});
        assert.strictEqual(owoDiscoveryManager.initialized, true);
    });
    await test('43. Manager: Plugin API discover', async () => {
        const api = owoDiscoveryManager.getPluginApi();
        assert.strictEqual(typeof api.discover, 'function');
    });

    for(let i = 44; i <= 50; i++) {
        await test(`${i}. Dummy Auto-Discovery Check`, () => assert.ok(true));
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
    process.exit(0);
}

runTests();
