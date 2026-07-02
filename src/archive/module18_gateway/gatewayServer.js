/**
 * gatewayServer.js — Main Enterprise Real-Time Gateway Framework (Module 18)
 * Wraps an HTTP server with Socket.IO, manages lifecycle and exposes Gateway API.
 */

const { Server } = require('socket.io');
const logger = require('../utils/logger');
const { authenticateSocket } = require('./middleware/gatewayAuth');
const connectionRegistry = require('./managers/connectionRegistry');
const subscriptionManager = require('./managers/subscriptionManager');
const realtimeDispatcher = require('./managers/realtimeDispatcher');
const realtimeMetrics = require('./managers/realtimeMetrics');

let io = null;
let discordClient = null;

/**
 * Initializes the WebSocket Gateway on top of an existing HTTP server.
 * @param {http.Server} httpServer The Node.js HTTP Server instance
 * @param {Client} client The Discord.js Client instance
 */
function init(httpServer, client) {
    discordClient = client;

    io = new Server(httpServer, {
        cors: {
            origin: process.env.API_CORS_ORIGIN || '*',
            methods: ['GET', 'POST']
        },
        pingInterval: 25000,
        pingTimeout: 20000,
        connectTimeout: 45000,
        // Allow permessage-deflate compression for payload size reduction
        perMessageDeflate: {
            threshold: 1024
        }
    });

    // 1. Authentication Middleware
    io.use(authenticateSocket);

    // 2. Handle Connections
    io.on('connection', (socket) => {
        // Register connection
        connectionRegistry.register(socket);

        // Client wants to subscribe to a topic
        socket.on('SUBSCRIBE', (payload) => {
            subscriptionManager.handleSubscribe(socket, payload?.topic);
        });

        // Client wants to unsubscribe
        socket.on('UNSUBSCRIBE', (payload) => {
            subscriptionManager.handleUnsubscribe(socket, payload?.topic);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            connectionRegistry.unregister(socket);
        });

        // Error handling
        socket.on('error', (err) => {
            logger.error(`[Gateway] Socket error on ${socket.id}:`, err.message);
        });
    });

    // 3. Initialize the Realtime Dispatcher (bridges EventBus)
    realtimeDispatcher.init(io);

    logger.info('[Gateway] ✅ Enterprise Real-Time Gateway initialized');
}

/**
 * Broadcasts a custom payload to a specific topic room directly.
 * @param {string} topic The topic/room name (e.g. 'custom.alert')
 * @param {object} payload The data to send
 */
function broadcast(topic, payload) {
    if (!io) return;
    const room = `topic:${topic}`;
    const message = { event: topic, data: payload, timestamp: new Date().toISOString() };
    io.to(room).emit('gateway.dispatch', message);
    
    // Estimate metrics
    realtimeMetrics.messageSent(JSON.stringify(message).length);
}

/**
 * Sends a direct message to a specific user via all their active socket connections.
 * @param {string} userId The target user ID
 * @param {string} event The event name
 * @param {object} payload The data to send
 */
function send(userId, event, payload) {
    if (!io) return;
    const socketIds = connectionRegistry.getSocketsForUser(userId);
    if (socketIds.length === 0) return;

    const message = { event, data: payload, timestamp: new Date().toISOString() };
    
    for (const socketId of socketIds) {
        io.to(socketId).emit('gateway.direct', message);
    }

    realtimeMetrics.messageSent(JSON.stringify(message).length * socketIds.length);
}

/**
 * Retrieves the current gateway metrics snapshot.
 */
function getMetrics() {
    return realtimeMetrics.getSnapshot();
}

/**
 * Stops the gateway gracefully.
 */
function stop() {
    if (io) {
        io.close(() => {
            logger.info('[Gateway] Gateway server stopped');
        });
        io = null;
    }
}

/**
 * Raw accessor for tests
 */
function getIO() {
    return io;
}

module.exports = { init, broadcast, send, getMetrics, stop, getIO };
