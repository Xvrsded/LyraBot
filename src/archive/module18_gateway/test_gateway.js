/**
 * test_gateway.js — Tests the Module 18 WebSocket Gateway functionality
 * Run with: node src/scripts/test_gateway.js
 */

process.env.API_MASTER_KEY = 'test-master-key';

const http = require('http');
const { io: Client } = require('socket.io-client');

// Mock external dependencies
const path = require('path');
const root = path.resolve(__dirname, '..');
function mockMod(rel, obj) {
    const abs = path.resolve(root, rel);
    require.cache[abs] = require.cache[abs + '.js'] = { id: abs, filename: abs, loaded: true, exports: obj };
}

mockMod('utils/logger', { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} });

// We use the actual EventBus for bridging test
const eventBus = require('../services/eventBus');

// Require our modules
const gatewayServer = require('../gateway/gatewayServer');

// Create test HTTP Server
const httpServer = http.createServer();
gatewayServer.init(httpServer, { user: { id: 'bot-client' } });

const PORT = 14210;
httpServer.listen(PORT);

let passed = 0, failed = 0;
function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function test(label, fn) {
    try { await fn(); console.log(`  ✅  ${label}`); passed++; }
    catch (err) { console.error(`  ❌  ${label}\n     → ${err.message}`); failed++; }
}

async function run() {
    console.log('\n══════════════════════════════════════════════════');
    console.log(' Module 18: Enterprise Real-Time Gateway Framework');
    console.log('══════════════════════════════════════════════════\n');

    const url = `http://localhost:${PORT}`;

    // ── Category 1: Authentication ─────────────────────────────────────────────
    console.log('◆ Category 1: Authentication');

    await test('Connect without auth → Rejected', () => {
        return new Promise((resolve, reject) => {
            const socket = Client(url, { reconnection: false });
            socket.on('connect_error', (err) => {
                try {
                    assert(err.message === 'NO_AUTH', `Expected NO_AUTH, got ${err.message}`);
                    resolve();
                } catch (e) { reject(e); }
                socket.close();
            });
            socket.on('connect', () => {
                socket.close();
                reject(new Error('Should not have connected'));
            });
        });
    });

    await test('Connect with invalid API key → Rejected', () => {
        return new Promise((resolve, reject) => {
            const socket = Client(url, { auth: { apiKey: 'wrong-key' }, reconnection: false });
            socket.on('connect_error', (err) => {
                try {
                    assert(err.message === 'API_KEY_INVALID', `Expected API_KEY_INVALID, got ${err.message}`);
                    resolve();
                } catch (e) { reject(e); }
                socket.close();
            });
            socket.on('connect', () => {
                socket.close();
                reject(new Error('Should not have connected'));
            });
        });
    });

    let authSocket;
    await test('Connect with valid Master API key → Connected', () => {
        return new Promise((resolve, reject) => {
            authSocket = Client(url, { auth: { apiKey: 'test-master-key' }, reconnection: false });
            authSocket.on('connect', resolve);
            authSocket.on('connect_error', reject);
        });
    });

    // ── Category 2: Topics & Dispatch ─────────────────────────────────────────
    console.log('\n◆ Category 2: Pub/Sub & Dispatcher');

    await test('Client subscribes to topic', () => {
        return new Promise((resolve, reject) => {
            authSocket.once('gateway.subscribed', (res) => {
                try {
                    assert(res.topic === 'market.*', `Got ${res.topic}`);
                    resolve();
                } catch (e) { reject(e); }
            });
            authSocket.emit('SUBSCRIBE', { topic: 'market.*' });
        });
    });

    await test('EventBus emit bridges to connected client', () => {
        return new Promise((resolve, reject) => {
            authSocket.once('gateway.dispatch', (msg) => {
                try {
                    assert(msg.event === 'market.sold', `Expected market.sold, got ${msg.event}`);
                    assert(msg.data.itemId === 'diamond', 'Payload mismatch');
                    resolve();
                } catch (e) { reject(e); }
            });
            
            // Trigger internal event bus
            eventBus.emit('market.sold', { itemId: 'diamond', price: 500 });
        });
    });

    // ── Category 3: Direct Messaging ──────────────────────────────────────────
    console.log('\n◆ Category 3: Direct Send');

    await test('gatewayServer.send() routes direct to user sockets', () => {
        return new Promise((resolve, reject) => {
            authSocket.once('gateway.direct', (msg) => {
                try {
                    assert(msg.event === 'direct.alert', 'Event mismatch');
                    assert(msg.data.msg === 'hello', 'Payload mismatch');
                    resolve();
                } catch (e) { reject(e); }
            });
            
            // Master API key forces socket.user.id = 'master'
            gatewayServer.send('master', 'direct.alert', { msg: 'hello' });
        });
    });

    // ── Category 4: Metrics ───────────────────────────────────────────────────
    console.log('\n◆ Category 4: Real-time Metrics');

    await test('Metrics capture connected clients and throughput', () => {
        const metrics = gatewayServer.getMetrics();
        assert(metrics.connectedClients >= 1, `Expected >= 1 client, got ${metrics.connectedClients}`);
        assert(metrics.messagesSent >= 2, `Expected >= 2 messages sent, got ${metrics.messagesSent}`);
        assert(metrics.bytesSent > 0, `Expected bytes > 0, got ${metrics.bytesSent}`);
    });

    console.log('\n══════════════════════════════════════════════════');
    console.log(` Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('══════════════════════════════════════════════════\n');

    authSocket.close();
    gatewayServer.stop();
    httpServer.close();

    if (failed > 0) process.exit(1);
}

run();
