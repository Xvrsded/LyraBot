/**
 * connectionRegistry.js — Manages active Socket.IO connections and mapping to user IDs (Module 18)
 */

const logger = require('../../utils/logger');
const realtimeMetrics = require('./realtimeMetrics');
const eventBus = require('../../services/eventBus');

class ConnectionRegistry {
    constructor() {
        // Mapping: userId -> Set of socketIds
        this.userSockets = new Map();
        // Mapping: socketId -> userId
        this.socketUser = new Map();
    }

    /**
     * Registers a newly connected and authenticated socket.
     */
    register(socket) {
        const userId = socket.user.id;
        const socketId = socket.id;

        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socketId);
        this.socketUser.set(socketId, userId);

        realtimeMetrics.clientConnected();
        logger.debug(`[Gateway] Socket connected: ${socketId} (User: ${userId})`);

        // Emit internal event for other plugins
        eventBus.emit('gateway.connect', { userId, socketId }, { plugin: 'gateway' });
    }

    /**
     * Unregisters a disconnected socket.
     */
    unregister(socket) {
        const socketId = socket.id;
        const userId = this.socketUser.get(socketId);

        if (userId) {
            const userSet = this.userSockets.get(userId);
            if (userSet) {
                userSet.delete(socketId);
                if (userSet.size === 0) {
                    this.userSockets.delete(userId);
                }
            }
            this.socketUser.delete(socketId);
            
            realtimeMetrics.clientDisconnected();
            logger.debug(`[Gateway] Socket disconnected: ${socketId} (User: ${userId})`);

            // Emit internal event for other plugins
            eventBus.emit('gateway.disconnect', { userId, socketId }, { plugin: 'gateway' });
        }
    }

    /**
     * Gets all socket IDs associated with a user ID.
     */
    getSocketsForUser(userId) {
        const set = this.userSockets.get(userId);
        return set ? Array.from(set) : [];
    }

    /**
     * Gets the user ID associated with a socket ID.
     */
    getUserForSocket(socketId) {
        return this.socketUser.get(socketId) || null;
    }
}

module.exports = new ConnectionRegistry();
