/**
 * test_economy.js - Offline test suite for Module 14: Economy & Financial Platform
 * Run with: node src/scripts/test_economy.js
 */

// ── In-memory database stores ─────────────────────────────────────────────────
const walletDb = {};
const ledgerDb = [];

// ── Mock Logger ───────────────────────────────────────────────────────────────
const mockLogger = {
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args)
};

// ── Mock EventBus ─────────────────────────────────────────────────────────────
const events = [];
const mockEventBus = { emit: (event, payload) => events.push({ event, payload }) };

// ── Build Wallet mock ─────────────────────────────────────────────────────────
function makeWallet(guildId, userId, data = {}) {
    const key = `${guildId}:${userId}`;
    const obj = {
        guildId,
        userId,
        coins: data.coins || 0,
        premiumCoins: data.premiumCoins || 0,
        experience: data.experience || 0,
        lifetimeEarnings: data.lifetimeEarnings || 0,
        lifetimeSpending: data.lifetimeSpending || 0,
        save: async function () { walletDb[key] = { ...this }; }
    };
    walletDb[key] = { ...obj };
    return obj;
}

const MockWallet = {
    findOne: async ({ guildId, userId }) => {
        const key = `${guildId}:${userId}`;
        if (!walletDb[key]) return null;
        const d = walletDb[key];
        return {
            ...d,
            save: async function () { walletDb[key] = { ...this }; }
        };
    }
};

const MockLedgerEntry = {
    create: async (data) => {
        const entry = { ...data, _id: `le_${ledgerDb.length + 1}` };
        ledgerDb.push(entry);
        return entry;
    }
};

// ── Override module cache before requiring services ───────────────────────────
const path = require('path');
const root = path.resolve(__dirname, '..');

function mockModule(relPath, mockObj) {
    const abs = path.resolve(root, relPath);
    require.cache[abs] = { id: abs, filename: abs, loaded: true, exports: mockObj };
    // Also register without .js extension variant
    require.cache[abs + '.js'] = require.cache[abs];
}

mockModule('models/Wallet',        MockWallet);
mockModule('models/LedgerEntry',   MockLedgerEntry);
mockModule('utils/logger',         mockLogger);
mockModule('services/eventBus',    mockEventBus);

// ── Now import the services (mocks are in cache first) ────────────────────────
const ledgerService       = require('../services/ledgerService');
const transactionPipeline = require('../services/transactionPipeline');
const rewardDistributor   = require('../services/rewardDistributor');

// ── Test Helpers ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

async function test(label, fn) {
    try {
        await fn();
        console.log(`  ✅  ${label}`);
        passed++;
    } catch (err) {
        console.error(`  ❌  ${label}`);
        console.error(`     Reason: ${err.message}`);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg);
}

// ── Test Cases ────────────────────────────────────────────────────────────────
async function run() {
    console.log('\n═══════════════════════════════════════════════');
    console.log(' Module 14: Economy & Financial Platform Tests ');
    console.log('═══════════════════════════════════════════════\n');

    const G  = 'guild-001';
    const U1 = 'user-001';
    const U2 = 'user-002';

    // ── 1. Deposit ────────────────────────────────────────────────────────────
    console.log('◆ Test 1: Basic Deposit');

    await test('Deposit 500 coins to user-001 (creates new wallet)', async () => {
        // Seed empty wallet first
        makeWallet(G, U1, { coins: 0 });
        const wallet = await transactionPipeline.deposit(G, U1, 500, 'coins', 'test-suite', 'Reward');
        assert(wallet.coins === 500, `Expected 500 coins, got ${wallet.coins}`);
    });

    await test('Deposit 200 more coins (cumulative = 700)', async () => {
        const wallet = await transactionPipeline.deposit(G, U1, 200, 'coins', 'test-suite', 'Reward');
        assert(wallet.coins === 700, `Expected 700 coins, got ${wallet.coins}`);
    });

    await test('lifetimeEarnings is 700 after two deposits', async () => {
        const key = `${G}:${U1}`;
        assert(walletDb[key].lifetimeEarnings === 700, `Expected 700, got ${walletDb[key].lifetimeEarnings}`);
    });

    // ── 2. Ledger Integrity ───────────────────────────────────────────────────
    console.log('\n◆ Test 2: Ledger Integrity');

    await test('Two ledger entries created so far', async () => {
        assert(ledgerDb.length === 2, `Expected 2 entries, got ${ledgerDb.length}`);
    });

    await test('Second ledger entry has balanceAfter = 700', async () => {
        const last = ledgerDb[1];
        assert(last.balanceAfter === 700, `Expected 700, got ${last.balanceAfter}`);
    });

    await test('Ledger entry has action=Reward and currency=coins', async () => {
        const last = ledgerDb[1];
        assert(last.action === 'Reward', `Expected Reward, got ${last.action}`);
        assert(last.currency === 'coins', `Expected coins, got ${last.currency}`);
    });

    // ── 3. Withdraw ───────────────────────────────────────────────────────────
    console.log('\n◆ Test 3: Withdraw');

    await test('Withdraw 100 coins => balance 600', async () => {
        const wallet = await transactionPipeline.withdraw(G, U1, 100, 'coins', 'test-suite', 'Purchase');
        assert(wallet.coins === 600, `Expected 600, got ${wallet.coins}`);
    });

    await test('lifetimeSpending = 100 after purchase', async () => {
        const key = `${G}:${U1}`;
        assert(walletDb[key].lifetimeSpending === 100, `Expected 100, got ${walletDb[key].lifetimeSpending}`);
    });

    await test('Insufficient balance throws correctly', async () => {
        let threw = false;
        try { await transactionPipeline.withdraw(G, U1, 99999, 'coins', 'test-suite', 'Purchase'); }
        catch (e) { threw = true; assert(e.message.includes('Saldo'), `Wrong error: ${e.message}`); }
        assert(threw, 'Should have thrown');
    });

    // ── 4. Transfer with 5% Tax ───────────────────────────────────────────────
    console.log('\n◆ Test 4: Transfer with 5% Tax');
    makeWallet(G, U2, { coins: 0 }); // Seed U2

    await test('Transfer 200 coins: tax=10, net=190', async () => {
        const result = await transactionPipeline.transfer(G, U1, U2, 200, 'coins', 'test-suite');
        assert(result.taxAmount === 10,  `Expected tax 10, got ${result.taxAmount}`);
        assert(result.netAmount === 190, `Expected net 190, got ${result.netAmount}`);
    });

    await test('user-001 balance = 400 after transfer (600 - 200)', async () => {
        assert(walletDb[`${G}:${U1}`].coins === 400, `Expected 400, got ${walletDb[`${G}:${U1}`].coins}`);
    });

    await test('user-002 balance = 190 (received net amount)', async () => {
        assert(walletDb[`${G}:${U2}`].coins === 190, `Expected 190, got ${walletDb[`${G}:${U2}`].coins}`);
    });

    // ── 5. Guards ─────────────────────────────────────────────────────────────
    console.log('\n◆ Test 5: Guards');

    await test('Block self-transfer', async () => {
        let threw = false;
        try { await transactionPipeline.transfer(G, U1, U1, 50); }
        catch (e) { threw = true; assert(e.message.includes('diri sendiri'), `Wrong error: ${e.message}`); }
        assert(threw, 'Should have thrown');
    });

    await test('Block zero-amount deposit', async () => {
        let threw = false;
        try { await transactionPipeline.deposit(G, U1, 0, 'coins', 'test-suite', 'Reward'); }
        catch (e) { threw = true; }
        assert(threw, 'Should have thrown on zero deposit');
    });

    await test('Block negative withdrawal', async () => {
        let threw = false;
        try { await transactionPipeline.withdraw(G, U1, -5, 'coins', 'test-suite', 'Purchase'); }
        catch (e) { threw = true; }
        assert(threw, 'Should have thrown on negative withdrawal');
    });

    // ── 6. RewardDistributor ──────────────────────────────────────────────────
    console.log('\n◆ Test 6: RewardDistributor');

    await test('RewardDistributor awards 50 coins to user-002 => 240', async () => {
        const wallet = await rewardDistributor.reward(G, U2, 50, 'coins', 'quest-engine');
        assert(wallet.coins === 240, `Expected 240, got ${wallet.coins}`);
    });

    // ── 7. EventBus Emission ──────────────────────────────────────────────────
    console.log('\n◆ Test 7: EventBus Event Emission');

    await test('economy.deposit event was emitted', async () => {
        assert(events.some(e => e.event === 'economy.deposit'), 'economy.deposit not found');
    });

    await test('economy.withdraw event was emitted', async () => {
        assert(events.some(e => e.event === 'economy.withdraw'), 'economy.withdraw not found');
    });

    await test('economy.transfer event was emitted', async () => {
        assert(events.some(e => e.event === 'economy.transfer'), 'economy.transfer not found');
    });

    await test('economy.reward event was emitted', async () => {
        assert(events.some(e => e.event === 'economy.reward'), 'economy.reward not found');
    });

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════');
    console.log(` Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('═══════════════════════════════════════════════\n');
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('[FATAL]', err);
    process.exit(1);
});
