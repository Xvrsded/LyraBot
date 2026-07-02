/**
 * test_api.js — Module 17: Enterprise Service API Framework
 * Run with: node src/scripts/test_api.js
 *
 * Spins up an isolated Express app (no Discord, no Mongo) using
 * in-memory mocks, then runs HTTP tests via Node's built-in http module.
 */

process.env.API_PORT       = '13177';  // isolated test port
process.env.API_MASTER_KEY = 'test-master-key';
process.env.TOKEN          = 'test-bot-token';
process.env.JWT_SECRET     = 'test-jwt-secret';
process.env.API_CORS_ORIGIN = '*';

const http = require('http');
const path = require('path');

// ── In-memory mock stores ─────────────────────────────────────────────────────
const walletDb  = {};
const ledgerDb  = [];
const invDb     = {};
const listingDb = {};
const auditDb   = [];
const questDb   = [];

// ── Mock services ─────────────────────────────────────────────────────────────
const root = path.resolve(__dirname, '..');

function mockMod(rel, obj) {
    const abs = path.resolve(root, rel);
    require.cache[abs] = require.cache[abs + '.js'] = { id: abs, filename: abs, loaded: true, exports: obj };
}

mockMod('utils/logger', { info: () => {}, warn: () => {}, error: () => {} });

mockMod('models/Wallet', {
    findOne: async ({ userId }) => walletDb[userId] || null
});

mockMod('models/LedgerEntry', {
    find: () => ({ sort: () => ({ skip: () => ({ limit: () => Promise.resolve(ledgerDb) }) }) }),
    countDocuments: async () => ledgerDb.length
});

mockMod('models/InventoryItem', {
    find: () => ({ limit: () => ({ sort: () => Promise.resolve([]) }) }),
    countDocuments: async () => 0
});

mockMod('models/MarketListing', {
    countDocuments: async () => Object.values(listingDb).filter(l => l.status === 'active').length
});

mockMod('models/TradeHistory', {
    find: () => ({ sort: () => ({ limit: () => Promise.resolve([]) }) })
});

mockMod('models/AuditEntry', {
    find: () => ({ sort: () => ({ skip: () => ({ limit: () => Promise.resolve(auditDb) }) }) }),
    countDocuments: async () => auditDb.length
});

mockMod('models/ModerationCase', {
    find: () => ({ sort: () => ({ skip: () => ({ limit: () => Promise.resolve([]) }) }) }),
    countDocuments: async () => 0,
    findOne: async () => null
});

mockMod('models/QuestProgress', {
    find: () => ({ sort: () => ({ limit: () => Promise.resolve(questDb) }) }),
    countDocuments: async () => 0
});

mockMod('services/transactionPipeline', {
    deposit:  async (g, u, amount) => { if (!walletDb[u]) walletDb[u] = { coins: 0, premiumCoins: 0, experience: 0 }; walletDb[u].coins += amount; return walletDb[u]; },
    withdraw: async (g, u, amount) => { if (!walletDb[u] || walletDb[u].coins < amount) throw new Error('Insufficient'); walletDb[u].coins -= amount; return walletDb[u]; },
    transfer: async (g, from, to, amount) => ({ from, to, amount })
});

mockMod('services/inventoryEngine',  { sort: async () => [] });
mockMod('services/inventoryService', { add: async (g,u,i,q) => ({ quantity: q }), remove: async () => {} });
mockMod('services/itemUsagePipeline', { use: async () => ({ success: true, applied: [], failed: [] }) });
mockMod('services/marketplaceSearch', {
    browse: async () => Object.values(listingDb).filter(l => l.status === 'active')
});
mockMod('services/listingService', { getById: async (id) => listingDb[id] ? { ...listingDb[id], toObject() { return { ...this }; } } : null });
mockMod('services/marketplaceEngine', {
    sell:   async () => ({ success: true, listing: { listingId: 'lst-001', status: 'active' } }),
    buy:    async () => ({ success: true, tradeId: 'trade-001', totalPrice: 100 }),
    cancel: async () => ({ success: true })
});
mockMod('services/itemRegistry', { get: () => null, getAll: () => [] });
mockMod('services/questRegistry', { getAll: () => [], get: () => null });
mockMod('services/achievementRegistry', { getAll: () => [], get: () => null });
mockMod('services/configService', {
    getAll: async () => ({ welcomeEnabled: true, prefix: '!' }),
    get:    async (g, key) => ({ welcomeEnabled: true })[key] ?? null,
    set:    async () => {}
});
mockMod('services/moderationEngine', {
    execute: async (opts) => ({ caseId: 'case-001', action: opts.action, targetId: opts.targetId })
});

// ── Build test Express app (no Mongo, no Discord) ─────────────────────────────
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');

const apiAuth          = require('../api/middleware/apiAuth');
const apiAuthorization = require('../api/middleware/apiAuthorization');
const apiRateLimiter   = require('../api/middleware/apiRateLimiter');
const apiMetrics       = require('../api/middleware/apiMetrics');
const apiResponse      = require('../api/formatters/apiResponse');
const openApiSpec      = require('../api/openapi/spec');
const { mountRoutes }  = require('../api/routeRegistry');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

mountRoutes(app, '/api/v1', { apiAuth, apiAuthorization, apiRateLimiter, apiMetrics, apiResponse, openApiSpec });

// ── Add 404 handler for test app ──────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json(apiResponse.error('NOT_FOUND', 'Not found.', null, req.correlationId));
});

// Seed wallet for tests
walletDb['user-001'] = { guildId: 'guild-001', userId: 'user-001', coins: 500, premiumCoins: 0, experience: 100, lifetimeEarnings: 1000, lifetimeSpending: 500 };

// ── Start test server ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env.API_PORT, 10);
const server = app.listen(PORT);

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, urlPath, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: 'localhost',
            port: PORT,
            path: urlPath,
            method,
            headers: { 'Content-Type': 'application/json', ...headers }
        };
        const req = http.request(opts, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
                catch (_) { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

const G = 'guild-001';
const U = 'user-001';
const MASTER_HEADERS = { 'X-API-Key': 'test-master-key' };

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

async function test(label, fn) {
    try { await fn(); console.log(`  ✅  ${label}`); passed++; }
    catch (err) { console.error(`  ❌  ${label}\n     → ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── Test suite ────────────────────────────────────────────────────────────────
async function run() {
    console.log('\n══════════════════════════════════════════════════');
    console.log(' Module 17: Enterprise Service API Framework');
    console.log('══════════════════════════════════════════════════\n');

    // ── Category 1: Auth Tests ────────────────────────────────────────────────
    console.log('◆ Category 1: Authentication Tests');

    await test('No auth → 401', async () => {
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/wallet`);
        assert(r.status === 401, `Expected 401, got ${r.status}`);
        assert(r.body.success === false, 'Expected success=false');
        assert(r.body.error?.code === 'NO_AUTH', `Unexpected code: ${r.body.error?.code}`);
    });

    await test('Invalid API key → 401', async () => {
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/wallet`, { 'X-API-Key': 'bad-key' });
        assert(r.status === 401, `Expected 401, got ${r.status}`);
        assert(r.body.error?.code === 'API_KEY_INVALID', `Unexpected code: ${r.body.error?.code}`);
    });

    await test('Valid master key → 200', async () => {
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/wallet`, MASTER_HEADERS);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.body.success === true, 'Expected success=true');
        assert(r.body.data.coins === 500, `Expected 500 coins, got ${r.body.data.coins}`);
    });

    await test('Valid Bot token → 200', async () => {
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/wallet`, {
            'Authorization': 'Bot test-bot-token'
        });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    await test('Invalid Bot token → 401', async () => {
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/wallet`, {
            'Authorization': 'Bot wrong-token'
        });
        assert(r.status === 401, `Expected 401, got ${r.status}`);
    });

    await test('JWT round-trip: sign → verify → 200', async () => {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { sub: 'test-user', role: 'MASTER', guildId: null, permissions: ['*'] },
            'test-jwt-secret',
            { expiresIn: '1h' }
        );
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/wallet`, {
            'Authorization': `Bearer ${token}`
        });
        assert(r.status === 200, `Expected 200 with JWT, got ${r.status}`);
    });

    // ── Category 2: System Routes ─────────────────────────────────────────────
    console.log('\n◆ Category 2: System Routes');

    await test('GET /health → 200 (no auth)', async () => {
        const r = await request('GET', '/api/v1/health');
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.body.data?.status === 'ok', 'Expected status=ok');
    });

    await test('GET /docs → valid OpenAPI JSON (no auth)', async () => {
        const r = await request('GET', '/api/v1/docs');
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.body?.openapi === '3.0.3', `Expected openapi=3.0.3, got ${r.body?.openapi}`);
        assert(r.body?.paths !== undefined, 'OpenAPI paths missing');
    });

    await test('GET /metrics → MASTER only, 200 with stats', async () => {
        const r = await request('GET', '/api/v1/metrics', MASTER_HEADERS);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.body.data?.summary?.totalRequests >= 0, 'Metrics totalRequests missing');
    });

    await test('GET /nonexistent-path → 404', async () => {
        const r = await request('GET', '/api/v1/nonexistent-xyz-path-that-does-not-exist', MASTER_HEADERS);
        assert(r.status === 404, `Expected 404, got ${r.status}: ${JSON.stringify(r.body?.error)}`);
        assert(r.body?.error?.code === 'NOT_FOUND', `Unexpected code: ${r.body?.error?.code}`);
    });

    // ── Category 3: Economy Routes ────────────────────────────────────────────
    console.log('\n◆ Category 3: Economy Routes');

    await test('GET wallet → returns wallet data', async () => {
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/wallet`, MASTER_HEADERS);
        assert(r.status === 200, `Got ${r.status}`);
        assert(typeof r.body.data.coins === 'number', 'Missing coins');
        assert(r.body.correlationId !== undefined, 'Missing correlationId');
    });

    await test('GET ledger → returns paginated entries', async () => {
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/ledger?page=1&limit=5`, MASTER_HEADERS);
        assert(r.status === 200, `Got ${r.status}`);
        assert(r.body.data.pagination !== undefined, 'Missing pagination');
    });

    await test('POST deposit → coins increase', async () => {
        const before = walletDb['user-001'].coins;
        const r = await request('POST', `/api/v1/economy/${G}/users/${U}/deposit`, MASTER_HEADERS, { amount: 100 });
        assert(r.status === 200, `Got ${r.status}`);
        assert(walletDb['user-001'].coins === before + 100, `Expected ${before + 100}, got ${walletDb['user-001'].coins}`);
    });

    await test('POST deposit with amount=0 → 400 validation error', async () => {
        const r = await request('POST', `/api/v1/economy/${G}/users/${U}/deposit`, MASTER_HEADERS, { amount: 0 });
        assert(r.status === 400, `Expected 400, got ${r.status}`);
        assert(r.body.error?.code === 'VALIDATION_ERROR', `Unexpected code: ${r.body.error?.code}`);
    });

    // ── Category 4: Inventory Routes ─────────────────────────────────────────
    console.log('\n◆ Category 4: Inventory Routes');

    await test('GET inventory → paginated items', async () => {
        const r = await request('GET', `/api/v1/inventory/${G}/users/${U}/inventory`, MASTER_HEADERS);
        assert(r.status === 200, `Got ${r.status}`);
        assert(r.body.data?.pagination !== undefined, 'Missing pagination');
    });

    // ── Category 5: Marketplace Routes ───────────────────────────────────────
    console.log('\n◆ Category 5: Marketplace Routes');

    await test('GET listings → active listings array', async () => {
        const r = await request('GET', `/api/v1/marketplace/${G}/listings`, MASTER_HEADERS);
        assert(r.status === 200, `Got ${r.status}`);
        assert(r.body.data?.pagination !== undefined, 'Missing pagination');
    });

    await test('POST listings (sell) → 201 with listing', async () => {
        const r = await request('POST', `/api/v1/marketplace/${G}/listings`, MASTER_HEADERS, {
            sellerId: U, itemId: 'hunter_potion', quantity: 1, pricePerUnit: 100
        });
        assert(r.status === 201, `Expected 201, got ${r.status}`);
        assert(r.body.data?.listingId !== undefined, 'Missing listingId');
    });

    // ── Category 6: Quest & Achievement Routes ────────────────────────────────
    console.log('\n◆ Category 6: Quest & Achievement Routes');

    await test('GET quests → quest definitions list', async () => {
        const r = await request('GET', `/api/v1/quests/${G}/quests`, MASTER_HEADERS);
        assert(r.status === 200, `Got ${r.status}`);
        assert(Array.isArray(r.body.data), `Expected array, got ${typeof r.body.data}`);
    });

    await test('GET user quests → user quest progress list', async () => {
        const r = await request('GET', `/api/v1/quests/${G}/users/${U}/quests`, MASTER_HEADERS);
        assert(r.status === 200, `Got ${r.status}`);
        assert(Array.isArray(r.body.data), `Expected array, got ${typeof r.body.data}`);
    });

    await test('GET achievements → achievement definitions list', async () => {
        const r = await request('GET', `/api/v1/achievements/${G}/achievements`, MASTER_HEADERS);
        assert(r.status === 200, `Got ${r.status}`);
        assert(Array.isArray(r.body.data), `Expected array, got ${typeof r.body.data}`);
    });

    // ── Category 7: Audit & Config Routes ────────────────────────────────────
    console.log('\n◆ Category 7: Audit & Config Routes');

    await test('GET audit log → paginated entries', async () => {
        const r = await request('GET', `/api/v1/audit/${G}/audit`, MASTER_HEADERS);
        assert(r.status === 200, `Got ${r.status}`);
        assert(r.body.data?.pagination !== undefined, 'Missing pagination');
    });

    await test('GET config → config map', async () => {
        const r = await request('GET', `/api/v1/config/${G}/config`, MASTER_HEADERS);
        assert(r.status === 200, `Got ${r.status}`);
        assert(typeof r.body.data === 'object', 'Expected object config');
    });

    await test('POST config → update config value', async () => {
        const r = await request('POST', `/api/v1/config/${G}/config`, MASTER_HEADERS, {
            key: 'welcomeEnabled', value: 'false'
        });
        assert(r.status === 200, `Got ${r.status}`);
        assert(r.body.data?.updated === true, 'Expected updated=true');
    });

    // ── Category 8: Profile Route ─────────────────────────────────────────────
    console.log('\n◆ Category 8: Profile Route');

    await test('GET profile → aggregated player profile', async () => {
        const r = await request('GET', `/api/v1/profile/${G}/users/${U}/profile`, MASTER_HEADERS);
        assert(r.status === 200, `Got ${r.status}`);
        assert(r.body.data?.userId === U, 'Missing userId in profile');
        assert(r.body.data?.economy !== null, 'Missing economy in profile');
        assert(r.body.data?.inventory !== undefined, 'Missing inventory in profile');
    });

    // ── Category 9: Response Format ───────────────────────────────────────────
    console.log('\n◆ Category 9: Response Format');

    await test('Response includes correlationId field', async () => {
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/wallet`, MASTER_HEADERS);
        assert(r.body.correlationId !== undefined, 'Missing correlationId');
        assert(typeof r.body.correlationId === 'string', 'correlationId must be string');
    });

    await test('Response includes timestamp field', async () => {
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/wallet`, MASTER_HEADERS);
        assert(r.body.timestamp !== undefined, 'Missing timestamp');
        assert(!isNaN(Date.parse(r.body.timestamp)), 'timestamp is not a valid ISO date');
    });

    await test('Error response has code + message', async () => {
        const r = await request('GET', `/api/v1/economy/${G}/users/${U}/wallet`);
        assert(r.body.error?.code !== undefined, 'Missing error.code');
        assert(r.body.error?.message !== undefined, 'Missing error.message');
    });

    // ── Category 10: Validation ───────────────────────────────────────────────
    console.log('\n◆ Category 10: Validation');

    await test('Missing required body field → 400 VALIDATION_ERROR', async () => {
        const r = await request('POST', `/api/v1/economy/${G}/users/${U}/deposit`, MASTER_HEADERS, {});
        assert(r.status === 400, `Expected 400, got ${r.status}`);
        assert(r.body.error?.code === 'VALIDATION_ERROR', `Unexpected: ${r.body.error?.code}`);
    });

    await test('Validation error includes field details array', async () => {
        const r = await request('POST', `/api/v1/economy/${G}/users/${U}/deposit`, MASTER_HEADERS, {});
        assert(Array.isArray(r.body.error?.details), 'Expected details to be an array');
        assert(r.body.error.details.length > 0, 'Expected at least 1 field error');
    });

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════');
    console.log(` Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('══════════════════════════════════════════════════\n');

    server.close();
    if (failed > 0) process.exit(1);
}

// Small delay to let server start
setTimeout(run, 300);
