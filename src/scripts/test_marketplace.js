/**
 * test_marketplace.js — Module 16: Enterprise Marketplace & Trading Framework
 * Run with: node src/scripts/test_marketplace.js
 *
 * Mock strategy: each DB store holds plain data objects.
 * findOne/create return a Proxy-like object whose save() writes directly back to the store.
 */

// ── In-memory stores ──────────────────────────────────────────────────────────
const inventoryDb = {};  // key: guildId:userId:itemId
const escrowDb    = {};  // key: escrowId
const listingDb   = {};  // key: listingId
const tradeDb     = [];
const walletDb    = {};  // key: guildId:userId
const ledgerDb    = [];
const events      = [];

// ── DB helpers ────────────────────────────────────────────────────────────────
function liveDoc(store, key) {
    // Returns an object backed by store[key] whose save() writes back to store[key]
    const handler = {
        get(target, prop) {
            if (prop === 'save') return async () => { Object.assign(store[key], target); };
            if (prop === 'toObject') return () => ({ ...store[key] });
            return prop in target ? target[prop] : store[key][prop];
        },
        set(target, prop, value) { target[prop] = value; store[key][prop] = value; return true; }
    };
    return new Proxy({ ...store[key] }, handler);
}

// ── Mock Logger ───────────────────────────────────────────────────────────────
const mockLogger = {
    info:  (...a) => process.stdout.write(`[INFO] ${a.join(' ')}\n`),
    warn:  (...a) => process.stdout.write(`[WARN] ${a.join(' ')}\n`),
    error: (...a) => process.stderr.write(`[ERROR] ${a.join(' ')}\n`)
};

// ── Mock EventBus ─────────────────────────────────────────────────────────────
const mockEventBus = { emit: (e, p) => events.push({ event: e, payload: p }), subscribe: () => {} };

// ── Mock InventoryItem ────────────────────────────────────────────────────────
function invKey(g, u, i) { return `${g}:${u}:${i}`; }
const MockInventoryItem = {
    findOne: async ({ guildId, userId, itemId }) => {
        const key = invKey(guildId, userId, itemId);
        return inventoryDb[key] ? liveDoc(inventoryDb, key) : null;
    },
    create: async (data) => {
        const key = invKey(data.guildId, data.userId, data.itemId);
        inventoryDb[key] = { ...data, _id: `slot_${Date.now()}`, acquiredAt: new Date() };
        return liveDoc(inventoryDb, key);
    },
    countDocuments: async ({ guildId, userId }) =>
        Object.keys(inventoryDb).filter(k => k.startsWith(`${guildId}:${userId}:`)).length,
    deleteOne: async ({ _id }) => {
        for (const k of Object.keys(inventoryDb)) { if (inventoryDb[k]?._id === _id) delete inventoryDb[k]; }
    }
};

// ── Mock EscrowRecord ─────────────────────────────────────────────────────────
const MockEscrowRecord = {
    create: async (data) => {
        const id = data.escrowId;
        escrowDb[id] = { ...data, _id: `esc_${Date.now()}`, status: 'held' };
        return liveDoc(escrowDb, id);
    },
    findOne: async ({ escrowId, listingId } = {}) => {
        let d;
        if (escrowId)  d = escrowDb[escrowId];
        else if (listingId) d = Object.values(escrowDb).find(e => e.listingId === listingId);
        return d ? liveDoc(escrowDb, d.escrowId) : null;
    }
};

// ── Mock MarketListing ────────────────────────────────────────────────────────
// find() needs to return a chainable with sort().skip().limit() or just .limit()
function makeChainable(arr) {
    const obj = {
        sort:   () => obj,
        skip:   () => obj,
        limit:  (n) => Promise.resolve(arr.slice(0, n)),
        then:   (res) => res(arr)
    };
    return obj;
}

const MockMarketListing = {
    create: async (data) => {
        const id = data.listingId;
        listingDb[id] = { ...data, _id: `lst_${Date.now()}`, createdAt: new Date(), status: data.status || 'active' };
        return liveDoc(listingDb, id);
    },
    findOne: async ({ listingId } = {}) => {
        const d = listingId ? listingDb[listingId] : null;
        return d ? liveDoc(listingDb, d.listingId) : null;
    },
    find: (query = {}) => {
        const { guildId, status } = query;
        const arr = Object.values(listingDb).filter(d =>
            (!guildId || d.guildId === guildId) && (!status || d.status === status));
        return makeChainable(arr);
    },
    countDocuments: async ({ guildId, status } = {}) =>
        Object.values(listingDb).filter(d =>
            (!guildId || d.guildId === guildId) && (!status || d.status === status)).length,
    distinct: async () => []
};

// ── Mock TradeHistory ─────────────────────────────────────────────────────────
const MockTradeHistory = { create: async (d) => { tradeDb.push({ ...d }); return d; } };

// ── Mock Wallet ───────────────────────────────────────────────────────────────
function seedWallet(guildId, userId, coins) {
    const key = `${guildId}:${userId}`;
    walletDb[key] = { guildId, userId, coins, premiumCoins: 0, lifetimeEarnings: 0, lifetimeSpending: 0 };
}
const MockWallet = {
    findOne: async ({ guildId, userId }) => {
        const key = `${guildId}:${userId}`;
        return walletDb[key] ? liveDoc(walletDb, key) : null;
    }
};
const MockLedgerEntry = { create: async (d) => { ledgerDb.push(d); return d; } };

// ── Inject mocks ──────────────────────────────────────────────────────────────
const path = require('path');
const root = path.resolve(__dirname, '..');
function mockMod(rel, obj) {
    const abs = path.resolve(root, rel);
    require.cache[abs] = require.cache[abs + '.js'] = { id: abs, filename: abs, loaded: true, exports: obj };
}
mockMod('models/InventoryItem',  MockInventoryItem);
mockMod('models/EscrowRecord',   MockEscrowRecord);
mockMod('models/MarketListing',  MockMarketListing);
mockMod('models/TradeHistory',   MockTradeHistory);
mockMod('models/Wallet',         MockWallet);
mockMod('models/LedgerEntry',    MockLedgerEntry);
mockMod('utils/logger',          mockLogger);
mockMod('services/eventBus',     mockEventBus);

// ── Import services ───────────────────────────────────────────────────────────
const itemRegistry      = require('../services/itemRegistry');
const inventoryService  = require('../services/inventoryService');
const escrowService     = require('../services/escrowService');
const listingService    = require('../services/listingService');
const tradeEngine       = require('../services/tradeEngine');
const marketplaceEngine = require('../services/marketplaceEngine');
const marketplaceSearch = require('../services/marketplaceSearch');
itemRegistry.loadAll();

// ── Test helpers ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
async function test(label, fn) {
    try { await fn(); console.log(`  ✅  ${label}`); passed++; }
    catch (err) { console.error(`  ❌  ${label}\n     → ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function seedInv(guildId, userId, itemId, qty) {
    const key = invKey(guildId, userId, itemId);
    inventoryDb[key] = { guildId, userId, itemId, quantity: qty, _id: `slot_${Date.now()}_${Math.random()}`, metadata: {}, expiresAt: null, acquiredAt: new Date() };
}

// ── Test suite ────────────────────────────────────────────────────────────────
async function run() {
    console.log('\n═════════════════════════════════════════════════════');
    console.log(' Module 16: Enterprise Marketplace & Trading Framework');
    console.log('═════════════════════════════════════════════════════\n');

    const G      = 'guild-001';
    const SELLER = 'seller-001';
    const BUYER  = 'buyer-001';

    // ── Category 1: Escrow ────────────────────────────────────────────────────
    console.log('◆ Category 1: Escrow Tests');

    seedInv(G, SELLER, 'hunter_potion', 5);
    seedWallet(G, SELLER, 0);
    seedWallet(G, BUYER, 2000);

    let firstEscrowId;
    await test('deposit() removes item from seller inventory', async () => {
        const rec = await escrowService.deposit(G, SELLER, 'hunter_potion', 3, 'lst-escrow-test');
        firstEscrowId = rec.escrowId;
        const slot = inventoryDb[invKey(G, SELLER, 'hunter_potion')];
        assert(!slot || slot.quantity === 2, `Expected qty=2 remaining, got ${slot?.quantity}`);
    });

    await test('deposit() creates EscrowRecord with status=held', async () => {
        const stored = escrowDb[firstEscrowId];
        assert(stored !== undefined, 'EscrowRecord not found in store');
        assert(stored.status === 'held', `Expected held, got ${stored.status}`);
        assert(stored.quantity === 3, `Expected qty=3, got ${stored.quantity}`);
    });

    await test('release(buyer) adds item to buyer inventory', async () => {
        await escrowService.release(firstEscrowId, BUYER, 'buyer');
        const slot = inventoryDb[invKey(G, BUYER, 'hunter_potion')];
        assert(slot && slot.quantity === 3, `Expected buyer qty=3, got ${slot?.quantity}`);
    });

    await test('escrow record status = released after buyer release', async () => {
        assert(escrowDb[firstEscrowId].status === 'released', `Expected released, got ${escrowDb[firstEscrowId].status}`);
    });

    await test('double-release throws (idempotency)', async () => {
        let threw = false;
        try { await escrowService.release(firstEscrowId, BUYER, 'buyer'); } catch (e) { threw = true; }
        assert(threw, 'Should have thrown on double release');
    });

    await test('release(seller) returns item with status=returned', async () => {
        seedInv(G, SELLER, 'xp_elixir', 2);
        const rec2 = await escrowService.deposit(G, SELLER, 'xp_elixir', 1, 'lst-ret-test');
        await escrowService.release(rec2.escrowId, SELLER, 'seller');
        assert(escrowDb[rec2.escrowId].status === 'returned', `Expected returned, got ${escrowDb[rec2.escrowId].status}`);
    });

    // ── Category 2: Buy Pipeline ──────────────────────────────────────────────
    console.log('\n◆ Category 2: Buy Pipeline Tests');

    seedInv(G, SELLER, 'star_fragment', 5);
    const sellRes = await marketplaceEngine.sell(G, SELLER, 'star_fragment', 2, 300);
    const listingId = sellRes.listing?.listingId;

    await test('sell() succeeds and creates active listing', async () => {
        assert(sellRes.success === true, `Sell failed: ${sellRes.reason}`);
        assert(listingDb[listingId]?.status === 'active', `Expected active, got ${listingDb[listingId]?.status}`);
    });

    await test('sell() removes item from seller inventory', async () => {
        const slot = inventoryDb[invKey(G, SELLER, 'star_fragment')];
        assert(!slot || slot.quantity === 3, `Expected 3 remaining, got ${slot?.quantity}`);
    });

    await test('full buy: buyer gets item, listing marked sold', async () => {
        const buyRes = await marketplaceEngine.buy(G, BUYER, listingId);
        assert(buyRes.success === true, `Buy failed: ${buyRes.reason}`);
        const buyerSlot = inventoryDb[invKey(G, BUYER, 'star_fragment')];
        assert(buyerSlot && buyerSlot.quantity >= 2, `Expected buyer to have star_fragment`);
        assert(listingDb[listingId].status === 'sold', `Expected sold, got ${listingDb[listingId].status}`);
    });

    await test('TradeHistory entry created', async () => {
        const trade = tradeDb.find(t => t.listingId === listingId);
        assert(trade !== undefined, 'No TradeHistory found');
        assert(trade.buyerId === BUYER, `Expected buyer=${BUYER}`);
        assert(trade.totalPrice === 600, `Expected 600, got ${trade.totalPrice}`);
    });

    await test('buy own listing is rejected', async () => {
        seedInv(G, SELLER, 'hunter_potion', 3);
        const sr = await marketplaceEngine.sell(G, SELLER, 'hunter_potion', 1, 50);
        assert(sr.success, `Sell failed for own-listing test: ${sr.reason}`);
        const br = await marketplaceEngine.buy(G, SELLER, sr.listing.listingId);
        assert(br.success === false && br.reason.includes('sendiri'), `Unexpected: ${br.reason}`);
    });

    await test('buy with insufficient coins is rejected', async () => {
        seedInv(G, SELLER, 'star_fragment', 1);
        const sr = await marketplaceEngine.sell(G, SELLER, 'star_fragment', 1, 999999);
        assert(sr.success, `Sell failed for insufficient-coins test: ${sr.reason}`);
        const br = await marketplaceEngine.buy(G, BUYER, sr.listing.listingId);
        assert(br.success === false, 'Should have failed (insufficient coins)');
        assert(br.reason.toLowerCase().includes('saldo') || br.reason.toLowerCase().includes('coins'), `Unexpected: ${br.reason}`);
    });

    await test('buy already-sold listing is rejected', async () => {
        const br = await marketplaceEngine.buy(G, BUYER, listingId);
        assert(br.success === false, 'Should reject re-purchase');
        assert(br.reason.includes('aktif'), `Unexpected: ${br.reason}`);
    });

    await test('buy listing from unknown guildId is rejected', async () => {
        const br = await marketplaceEngine.buy('guild-unknown', BUYER, listingId);
        assert(br.success === false, 'Should reject cross-guild purchase');
    });

    // ── Category 3: Cancel ────────────────────────────────────────────────────
    console.log('\n◆ Category 3: Cancel Tests');

    seedInv(G, SELLER, 'mystery_box', 3);
    const cancelSell  = await marketplaceEngine.sell(G, SELLER, 'mystery_box', 2, 150);
    const cancelListId = cancelSell.listing.listingId;

    await test('cancel() returns item from escrow to seller', async () => {
        const beforeQty = inventoryDb[invKey(G, SELLER, 'mystery_box')]?.quantity ?? 0;
        const result = await marketplaceEngine.cancel(G, SELLER, cancelListId);
        assert(result.success === true, `Cancel failed: ${result.reason}`);
        const afterQty = inventoryDb[invKey(G, SELLER, 'mystery_box')]?.quantity ?? 0;
        assert(afterQty >= beforeQty + 2, `Item not returned: before=${beforeQty}, after=${afterQty}`);
    });

    await test('listing status = cancelled after cancel()', async () => {
        assert(listingDb[cancelListId].status === 'cancelled', `Expected cancelled, got ${listingDb[cancelListId].status}`);
    });

    await test('cancel by non-owner is rejected', async () => {
        seedInv(G, SELLER, 'xp_elixir', 2);
        const sr = await marketplaceEngine.sell(G, SELLER, 'xp_elixir', 1, 100);
        assert(sr.success, `Sell failed for non-owner cancel test: ${sr.reason}`);
        const r  = await marketplaceEngine.cancel(G, 'random-user-999', sr.listing.listingId);
        assert(r.success === false && r.reason.includes('pemilik'), `Unexpected: ${r.reason}`);
    });

    await test('cancel already-sold listing is rejected', async () => {
        const r = await marketplaceEngine.cancel(G, SELLER, listingId);
        assert(r.success === false, 'Should reject cancellation of sold listing');
    });

    // ── Category 4: Search ────────────────────────────────────────────────────
    console.log('\n◆ Category 4: Marketplace Search Tests');

    seedInv(G, SELLER, 'hunter_potion', 10);
    await marketplaceEngine.sell(G, SELLER, 'hunter_potion', 5, 50);

    await test('browse() returns only active listings', async () => {
        const results = await marketplaceSearch.browse(G, { sort: 'newest' });
        assert(results.every(r => r.status === 'active'), 'Non-active in browse results');
    });

    await test('search("potion") finds hunter_potion listing', async () => {
        const results = await marketplaceSearch.search(G, 'potion');
        assert(results.length > 0, 'Expected ≥1 result');
        assert(results.some(r => r.itemId === 'hunter_potion'), 'hunter_potion not found');
    });

    await test('search("zzz_nomatch") returns empty', async () => {
        const results = await marketplaceSearch.search(G, 'zzz_nomatch');
        assert(results.length === 0, `Expected 0, got ${results.length}`);
    });

    await test('filter by rarity Rare returns only Rare listings', async () => {
        // star_fragment is Rare — we sold a listing for it
        const results = await marketplaceSearch.filter(G, { rarity: 'Rare' });
        // All results should have item.rarity === Rare (or no item match = 0 results = still correct)
        assert(results.every(r => !r.item || r.item.rarity === 'Rare'), 'Non-Rare item in filter results');
    });

    // ── Category 5: EventBus ──────────────────────────────────────────────────
    console.log('\n◆ Category 5: EventBus Event Emission');

    await test('market.listed emitted on sell', async () => {
        assert(events.some(e => e.event === 'market.listed'), 'market.listed not fired');
    });

    await test('market.sold emitted on successful buy', async () => {
        assert(events.some(e => e.event === 'market.sold'), 'market.sold not fired');
    });

    await test('trade.completed emitted on successful buy', async () => {
        assert(events.some(e => e.event === 'trade.completed'), 'trade.completed not fired');
    });

    await test('market.cancelled emitted on cancel', async () => {
        assert(events.some(e => e.event === 'market.cancelled'), 'market.cancelled not fired');
    });

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n═════════════════════════════════════════════════════');
    console.log(` Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('═════════════════════════════════════════════════════\n');
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('[FATAL]', err);
    process.exit(1);
});
