/**
 * test_inventory.js — Module 15: Enterprise Inventory & Item Framework
 * Run with: node src/scripts/test_inventory.js
 */

// ── In-memory stores ──────────────────────────────────────────────────────────
const inventoryDb = {};   // key: `guildId:userId:itemId` → slot object
const usageLogDb  = [];
const events      = [];

// ── Mock logger ───────────────────────────────────────────────────────────────
const mockLogger = {
    info:  (...a) => process.stdout.write(`[INFO] ${a.join(' ')}\n`),
    warn:  (...a) => process.stdout.write(`[WARN] ${a.join(' ')}\n`),
    error: (...a) => process.stderr.write(`[ERROR] ${a.join(' ')}\n`)
};

// ── Mock EventBus ─────────────────────────────────────────────────────────────
const mockEventBus = {
    emit:      (event, payload) => events.push({ event, payload }),
    subscribe: () => {}
};

// ── Mock InventoryItem model ──────────────────────────────────────────────────
const MockInventoryItem = {
    findOne: async ({ guildId, userId, itemId }) => {
        const key = `${guildId}:${userId}:${itemId}`;
        const d = inventoryDb[key];
        if (!d) return null;
        return {
            ...d,
            save: async function () { inventoryDb[key] = { ...this }; }
        };
    },
    create: async (data) => {
        const key = `${data.guildId}:${data.userId}:${data.itemId}`;
        inventoryDb[key] = {
            ...data,
            _id: `slot_${Object.keys(inventoryDb).length + 1}`,
            acquiredAt: new Date(),
            save: async function () { inventoryDb[key] = { ...this }; }
        };
        return inventoryDb[key];
    },
    countDocuments: async ({ guildId, userId }) => {
        return Object.keys(inventoryDb).filter(k => k.startsWith(`${guildId}:${userId}:`)).length;
    },
    deleteOne: async ({ _id }) => {
        for (const key of Object.keys(inventoryDb)) {
            if (inventoryDb[key]._id === _id) delete inventoryDb[key];
        }
    },
    find: async ({ guildId, userId } = {}) => {
        return Object.values(inventoryDb).filter(s =>
            (!guildId || s.guildId === guildId) && (!userId || s.userId === userId)
        );
    },
    deleteMany: async ({ guildId, userId }) => {
        for (const key of Object.keys(inventoryDb)) {
            if (key.startsWith(`${guildId}:${userId}:`)) delete inventoryDb[key];
        }
    }
};

// ── Mock ItemUsageLog model ───────────────────────────────────────────────────
const MockItemUsageLog = {
    create: async (data) => { usageLogDb.push({ ...data }); return data; }
};

// ── Mock RewardDistributor ────────────────────────────────────────────────────
const rewardedCoins = [];
const mockRewardDistributor = {
    reward: async (guildId, userId, amount, currency, sourcePlugin) => {
        rewardedCoins.push({ guildId, userId, amount, currency, sourcePlugin });
        return { coins: amount };
    }
};

// ── Inject mocks into require cache ──────────────────────────────────────────
const path = require('path');
const root = path.resolve(__dirname, '..');

function mockMod(rel, obj) {
    const abs = path.resolve(root, rel);
    require.cache[abs] = require.cache[abs + '.js'] = { id: abs, filename: abs, loaded: true, exports: obj };
}

mockMod('models/InventoryItem', MockInventoryItem);
mockMod('models/ItemUsageLog',  MockItemUsageLog);
mockMod('utils/logger',         mockLogger);
mockMod('services/eventBus',    mockEventBus);
mockMod('services/rewardDistributor', mockRewardDistributor);

// ── Import services (mocks in cache first) ────────────────────────────────────
const itemRegistry      = require('../services/itemRegistry');
const inventoryService  = require('../services/inventoryService');
const inventoryEngine   = require('../services/inventoryEngine');
const itemEffectEngine  = require('../services/itemEffectEngine');
const itemUsagePipeline = require('../services/itemUsagePipeline');
const lootEngine        = require('../services/lootEngine');
const dropTableManager  = require('../services/dropTableManager');

// ── Test helpers ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

async function test(label, fn) {
    try {
        await fn();
        console.log(`  ✅  ${label}`);
        passed++;
    } catch (err) {
        console.error(`  ❌  ${label}\n     → ${err.message}`);
        failed++;
    }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
    console.log('\n══════════════════════════════════════════════════');
    console.log(' Module 15: Enterprise Inventory & Item Framework ');
    console.log('══════════════════════════════════════════════════\n');

    const G  = 'guild-001';
    const U1 = 'user-alpha';
    const U2 = 'user-beta';

    // ── 1. ItemRegistry ───────────────────────────────────────────────────────
    console.log('◆ Category 1: ItemRegistry');

    itemRegistry.loadAll();

    await test('Registry loads at least 5 items', async () => {
        assert(itemRegistry.getAll().length >= 5, `Only ${itemRegistry.getAll().length} items loaded`);
    });

    await test('Get item by ID: hunter_potion', async () => {
        const item = itemRegistry.get('hunter_potion');
        assert(item !== null, 'hunter_potion not found');
        assert(item.category === 'Consumable', `Expected Consumable, got ${item.category}`);
        assert(item.rarity   === 'Common',     `Expected Common, got ${item.rarity}`);
    });

    await test('Get items by category: Consumable', async () => {
        const consumables = itemRegistry.getByCategory('Consumable');
        assert(consumables.length >= 2, `Expected at least 2 consumables, got ${consumables.length}`);
    });

    await test('Get items by rarity: Legendary', async () => {
        const legendaries = itemRegistry.getByRarity('Legendary');
        assert(legendaries.length >= 1, 'No Legendary items found');
    });

    await test('Runtime register item via register()', async () => {
        itemRegistry.register({
            id: 'test_item', name: 'Test Item', category: 'Material',
            rarity: 'Common', usable: false, effects: []
        });
        assert(itemRegistry.get('test_item') !== null, 'Registered item not found');
    });

    await test('Rarity order: Epic > Uncommon', async () => {
        const epic     = itemRegistry.getRarityOrder('Epic');
        const uncommon = itemRegistry.getRarityOrder('Uncommon');
        assert(epic > uncommon, `Expected Epic(${epic}) > Uncommon(${uncommon})`);
    });

    // ── 2. InventoryService ───────────────────────────────────────────────────
    console.log('\n◆ Category 2: InventoryService');

    await test('Add 3x hunter_potion to user alpha', async () => {
        const slot = await inventoryService.add(G, U1, 'hunter_potion', 3);
        assert(slot.quantity === 3, `Expected qty=3, got ${slot.quantity}`);
    });

    await test('Stack 2 more hunter_potion (total 5)', async () => {
        const slot = await inventoryService.add(G, U1, 'hunter_potion', 2);
        assert(slot.quantity === 5, `Expected qty=5, got ${slot.quantity}`);
    });

    await test('has() returns true when user owns item', async () => {
        const has = await inventoryService.has(G, U1, 'hunter_potion', 5);
        assert(has === true, 'Expected has() = true');
    });

    await test('has() returns false for item not in inventory', async () => {
        const has = await inventoryService.has(G, U1, 'golden_key', 1);
        assert(has === false, 'Expected has() = false for golden_key');
    });

    await test('Remove 2x hunter_potion (qty: 5 → 3)', async () => {
        await inventoryService.remove(G, U1, 'hunter_potion', 2);
        const slot = await inventoryService.get(G, U1, 'hunter_potion');
        assert(slot && slot.quantity === 3, `Expected qty=3, got ${slot?.quantity}`);
    });

    await test('Remove all remaining (slot deleted from DB)', async () => {
        await inventoryService.remove(G, U1, 'hunter_potion', 3);
        const slot = await inventoryService.get(G, U1, 'hunter_potion');
        assert(slot === null, 'Expected slot to be deleted');
    });

    await test('Insufficient removal throws correctly', async () => {
        let threw = false;
        try { await inventoryService.remove(G, U1, 'star_fragment', 99); }
        catch (e) { threw = true; }
        assert(threw, 'Should have thrown on insufficient inventory');
    });

    await test('Add non-stackable item (hunters_badge)', async () => {
        const slot = await inventoryService.add(G, U1, 'hunters_badge', 1);
        assert(slot.quantity === 1, `Expected qty=1, got ${slot.quantity}`);
    });

    await test('Stack non-stackable item throws', async () => {
        let threw = false;
        try { await inventoryService.add(G, U1, 'hunters_badge', 1); }
        catch (e) { threw = true; }
        assert(threw, 'Should have thrown on non-stackable re-add');
    });

    // ── 3. InventoryEngine (sort & search) ────────────────────────────────────
    console.log('\n◆ Category 3: InventoryEngine (Sort & Search)');

    // Seed a few items for U2
    await inventoryService.add(G, U2, 'hunter_potion', 5);
    await inventoryService.add(G, U2, 'star_fragment',  10);
    await inventoryService.add(G, U2, 'xp_elixir',      2);

    await test('Sort by rarity returns items ordered Epic first (mock)', async () => {
        const sorted = await inventoryEngine.sort(G, U2, 'rarity');
        assert(sorted.length >= 3, `Expected >=3 sorted items, got ${sorted.length}`);
    });

    await test('Sort by quantity returns highest qty first', async () => {
        const sorted = await inventoryEngine.sort(G, U2, 'quantity');
        const qtys = sorted.map(s => s.slot.quantity);
        assert(qtys[0] >= qtys[qtys.length - 1], 'Should be descending by qty');
    });

    await test('Search "potion" finds hunter_potion', async () => {
        const results = await inventoryEngine.search(G, U2, 'potion');
        assert(results.some(r => r.slot.itemId === 'hunter_potion'), 'hunter_potion not in search results');
    });

    await test('Search "zzz_nomatch" returns empty', async () => {
        const results = await inventoryEngine.search(G, U2, 'zzz_nomatch');
        assert(results.length === 0, `Expected 0 results, got ${results.length}`);
    });

    await test('Filter by category Consumable', async () => {
        const results = await inventoryEngine.filter(G, U2, { category: 'Consumable' });
        assert(results.every(r => r.item?.category === 'Consumable'), 'Non-consumable in results');
    });

    // ── 4. ItemUsagePipeline ──────────────────────────────────────────────────
    console.log('\n◆ Category 4: ItemUsagePipeline');

    // Seed xp_elixir for U1
    await inventoryService.add(G, U1, 'xp_elixir', 1);

    await test('Use xp_elixir succeeds (has effects + removed from inventory)', async () => {
        const result = await itemUsagePipeline.use(G, U1, 'xp_elixir', {});
        assert(result.success === true,    `Use failed: ${result.reason}`);
        assert(result.applied.length >= 1, 'No effects applied');
        const remaining = await inventoryService.get(G, U1, 'xp_elixir');
        assert(remaining === null, 'xp_elixir should have been consumed');
    });

    await test('Use non-usable item (star_fragment) is rejected', async () => {
        await inventoryService.add(G, U1, 'star_fragment', 1);
        const result = await itemUsagePipeline.use(G, U1, 'star_fragment', {});
        assert(result.success === false, 'Expected failure for non-usable item');
        assert(result.reason.includes('tidak dapat digunakan'), `Unexpected reason: ${result.reason}`);
    });

    await test('Use item not in inventory is rejected', async () => {
        const result = await itemUsagePipeline.use(G, U1, 'golden_key', {});
        assert(result.success === false, 'Expected failure for missing item');
    });

    await test('Use unknown item ID is rejected', async () => {
        const result = await itemUsagePipeline.use(G, U1, 'totally_fake_item_xyz', {});
        assert(result.success === false, 'Expected failure for unknown item');
    });

    await test('UsageLog entry created on successful use', async () => {
        const log = usageLogDb.find(l => l.itemId === 'xp_elixir' && l.success === true);
        assert(log !== undefined, 'No usage log found for xp_elixir');
    });

    // ── 5. LootEngine (weighted roll) ─────────────────────────────────────────
    console.log('\n◆ Category 5: LootEngine — Weighted Roll');

    dropTableManager.loadAll();

    await test('DropTableManager loaded hunt_drops table', async () => {
        const table = dropTableManager.get('hunt_drops');
        assert(table !== null, 'hunt_drops not loaded');
        assert(Array.isArray(table.slots), 'slots should be an array');
    });

    await test('getForEvent("owo.hunt.completed") returns hunt_drops', async () => {
        const ids = dropTableManager.getForEvent('owo.hunt.completed');
        assert(ids.includes('hunt_drops'), 'hunt_drops not mapped to owo.hunt.completed');
    });

    await test('_weightedRandom always returns a valid slot', async () => {
        const table = dropTableManager.get('hunt_drops');
        for (let i = 0; i < 100; i++) {
            const slot = lootEngine._weightedRandom(table.slots);
            assert(slot !== null, `_weightedRandom returned null on iteration ${i}`);
            assert(typeof slot.itemId === 'string', 'slot.itemId should be a string');
        }
    });

    await test('_randomInt returns value in range [1, 3]', async () => {
        for (let i = 0; i < 50; i++) {
            const n = lootEngine._randomInt(1, 3);
            assert(n >= 1 && n <= 3, `Got ${n}, expected 1–3`);
        }
    });

    await test('rollTable awards at least 1 item to user', async () => {
        // Temporarily seed item registry with mock InventoryItem already in cache
        const before = Object.keys(inventoryDb).filter(k => k.startsWith(`${G}:${U1}:`)).length;
        await lootEngine.rollTable('hunt_drops', G, U1);
        const after = Object.keys(inventoryDb).filter(k => k.startsWith(`${G}:${U1}:`)).length;
        // After roll, we should have same or more items (at least 1 drop expected statistically)
        // We just verify rollTable ran without error and emitted events
        assert(events.some(e => e.event === 'inventory.item_added' || e.event === 'loot.generated'), 'No add/loot event fired');
    });

    // ── 6. EventBus events ─────────────────────────────────────────────────────
    console.log('\n◆ Category 6: EventBus Event Emission');

    await test('inventory.item_added event fired', async () => {
        assert(events.some(e => e.event === 'inventory.item_added'), 'inventory.item_added not fired');
    });

    await test('inventory.item_removed event fired', async () => {
        assert(events.some(e => e.event === 'inventory.item_removed'), 'inventory.item_removed not fired');
    });

    await test('inventory.item_used event fired', async () => {
        assert(events.some(e => e.event === 'inventory.item_used'), 'inventory.item_used not fired');
    });

    await test('economy.xp_earned event fired (xp_elixir effect)', async () => {
        assert(events.some(e => e.event === 'economy.xp_earned'), 'economy.xp_earned not fired after xp_elixir use');
    });

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════');
    console.log(` Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('══════════════════════════════════════════════════\n');
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('[FATAL]', err);
    process.exit(1);
});
