/**
 * test_dashboard.js — Tests the Dashboard Backend API (Module 19)
 * Run with: node src/scripts/test_dashboard.js
 */

process.env.API_PORT = '14322';
process.env.DISCORD_CLIENT_ID = 'mock_client_id'; // Enable mock mode
process.env.DISCORD_CLIENT_SECRET = 'mock_secret';
process.env.JWT_SECRET = 'test-dashboard-jwt';
process.env.NODE_ENV = 'development';

const http = require('http');
const express = require('express');
const path = require('path');

// Mocks
const root = path.resolve(__dirname, '..');
function mockMod(rel, obj) {
    const abs = path.resolve(root, rel);
    require.cache[abs] = require.cache[abs + '.js'] = { id: abs, filename: abs, loaded: true, exports: obj };
}
mockMod('utils/logger', { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} });

// Mock Models
const sessions = [];
const prefs = {};
const notifs = [];

class MockDashboardSession {
    constructor(data) { Object.assign(this, data); }
    async save() { if (!sessions.includes(this)) sessions.push(this); return this; }
}
MockDashboardSession.findOne = async (q) => sessions.find(s => s.sessionId === q.sessionId && s.refreshToken === q.refreshToken) || null;
MockDashboardSession.deleteOne = async (q) => { const idx = sessions.findIndex(s => s.sessionId === q.sessionId); if(idx !== -1) sessions.splice(idx, 1); };
MockDashboardSession.find = async () => sessions;
MockDashboardSession.countDocuments = async () => sessions.length;
mockMod('models/DashboardSession', MockDashboardSession);

class MockDashboardPreferences {
    constructor(data) { Object.assign(this, data); }
    async save() { prefs[this.userId] = this; return this; }
    toObject() { return { ...this }; }
}
MockDashboardPreferences.findOne = async (q) => prefs[q.userId] ? prefs[q.userId] : null;
MockDashboardPreferences.findOneAndUpdate = async (q, u) => { 
    if (!prefs[q.userId]) prefs[q.userId] = new MockDashboardPreferences({ userId: q.userId });
    Object.assign(prefs[q.userId], u.$set); 
    return prefs[q.userId]; 
};
mockMod('models/DashboardPreferences', MockDashboardPreferences);

class MockDashboardNotification {
    constructor(data) { Object.assign(this, data); }
    async save() { this._id = 'notif-1'; notifs.push(this); return this; }
    toObject() { return { ...this }; }
}
MockDashboardNotification.find = () => ({ sort: () => ({ limit: async () => notifs.filter(n => n.userId === 'mock_user_123' && !n.isRead) }) });
MockDashboardNotification.updateOne = async (q, u) => { const n = notifs.find(x => x._id === q._id); if (n) Object.assign(n, u.$set); };
MockDashboardNotification.updateMany = async (q, u) => { notifs.forEach(n => { if(n.userId === q.userId) Object.assign(n, u.$set); }); };
mockMod('models/DashboardNotification', MockDashboardNotification);

mockMod('gateway/gatewayServer', { send: () => {} });
mockMod('api/formatters/apiResponse', require('../api/formatters/apiResponse'));

// Load routes
const dashboardRoutes = require('../dashboard/dashboardRoutes');
const dashboardWidgetRegistry = require('../dashboard/managers/dashboardWidgetRegistry');

const app = express();
app.use(express.json());
app.use('/api/v1/dashboard', dashboardRoutes);

const server = app.listen(process.env.API_PORT);

// HTTP helper
function request(method, urlPath, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const opts = { hostname: 'localhost', port: process.env.API_PORT, path: urlPath, method, headers: { 'Content-Type': 'application/json', ...headers } };
        const req = http.request(opts, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const result = { status: res.statusCode, headers: res.headers };
                try { result.body = JSON.parse(data); } catch (_) { result.body = data; }
                resolve(result);
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Tests
let passed = 0, failed = 0;
function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function test(label, fn) {
    try { await fn(); console.log(`  ✅  ${label}`); passed++; }
    catch (err) { console.error(`  ❌  ${label}\n     → ${err.message}`); failed++; }
}

async function run() {
    console.log('\n══════════════════════════════════════════════════');
    console.log(' Module 19: Enterprise Dashboard Backend');
    console.log('══════════════════════════════════════════════════\n');

    let jwtToken = '';
    let cookies = [];

    // ── Auth Flow ─────────────────────────────────────────────────────────────
    console.log('◆ Authentication');
    
    await test('GET /auth/discord/callback exchanges code for JWT and sets cookies', async () => {
        const r = await request('GET', '/api/v1/dashboard/auth/discord/callback?code=mock_code');
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.body.success === true, 'Expected success');
        assert(r.body.data.jwt !== undefined, 'Missing JWT');
        assert(r.body.data.user.id === 'mock_user_123', 'Mock user mismatch');
        assert(r.headers['set-cookie']?.length >= 2, 'Missing session cookies');
        
        jwtToken = r.body.data.jwt;
        cookies = r.headers['set-cookie'].map(c => c.split(';')[0]);
    });

    await test('POST /auth/refresh generates new JWT using cookies', async () => {
        const r = await request('POST', '/api/v1/dashboard/auth/refresh', { 'Cookie': cookies.join('; ') });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.body.data.jwt !== undefined, 'Missing refreshed JWT');
    });

    // ── Widget Registry ───────────────────────────────────────────────────────
    console.log('\n◆ Widget Registry');

    await test('Widget Registration via API works', async () => {
        dashboardWidgetRegistry.registerWidget({ id: 'test_widget', title: 'Test' });
        dashboardWidgetRegistry.registerPage({ id: 'test_page', route: '/test' });
        
        const r1 = await request('GET', '/api/v1/dashboard/registry/widgets', { Authorization: `Bearer ${jwtToken}` });
        assert(r1.body.data[0].id === 'test_widget', 'Widget not found');

        const r2 = await request('GET', '/api/v1/dashboard/registry/pages', { Authorization: `Bearer ${jwtToken}` });
        assert(r2.body.data[0].id === 'test_page', 'Page not found');
    });

    // ── Preferences ───────────────────────────────────────────────────────────
    console.log('\n◆ User Preferences');

    await test('PUT /preferences updates theme', async () => {
        const r = await request('PUT', '/api/v1/dashboard/preferences', { Authorization: `Bearer ${jwtToken}` }, { theme: 'light' });
        assert(r.status === 200, `Got ${r.status}`);
        assert(r.body.data.theme === 'light', 'Theme not updated');
    });

    await test('GET /preferences retrieves preferences', async () => {
        const r = await request('GET', '/api/v1/dashboard/preferences', { Authorization: `Bearer ${jwtToken}` });
        assert(r.body.data.theme === 'light', 'Theme not retrieved');
    });

    // ── Notifications ─────────────────────────────────────────────────────────
    console.log('\n◆ Notification Center');

    await test('Retrieve and mark notifications as read', async () => {
        const notifCenter = require('../dashboard/managers/dashboardNotificationCenter');
        await notifCenter.push('mock_user_123', 'SYSTEM', 'Test', 'Hello');
        
        const r1 = await request('GET', '/api/v1/dashboard/notifications', { Authorization: `Bearer ${jwtToken}` });
        assert(r1.body.data.length === 1, 'Expected 1 unread notification');

        const r2 = await request('POST', `/api/v1/dashboard/notifications/${r1.body.data[0]._id}/read`, { Authorization: `Bearer ${jwtToken}` });
        assert(r2.status === 200, 'Failed to mark read');
    });

    // ── Stats ─────────────────────────────────────────────────────────────────
    console.log('\n◆ Dashboard Statistics');

    await test('Retrieve metrics (Requires MASTER)', async () => {
        const r = await request('GET', '/api/v1/dashboard/stats', { Authorization: `Bearer ${jwtToken}` });
        assert(r.status === 200, `Got ${r.status}`);
        assert(r.body.data.loginCount === 1, 'Login count not incremented');
        assert(r.body.data.activeSessions === 1, 'Active session count mismatch');
    });

    console.log('\n══════════════════════════════════════════════════');
    console.log(` Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('══════════════════════════════════════════════════\n');

    server.close();
    if (failed > 0) process.exit(1);
}

run();
