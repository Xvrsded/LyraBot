/**
 * realtimeDispatcher.js — Bridges internal EventBus with Socket.IO gateway (Module 18)
 */

const eventBus = require('../../services/eventBus');
const logger = require('../../utils/logger');
const realtimeMetrics = require('./realtimeMetrics');

class RealtimeDispatcher {
    constructor() {
        this.io = null;
    }

    /**
     * Initializes the dispatcher with the Socket.IO server instance.
     */
    init(ioServer) {
        this.io = ioServer;
        
        // Listen to ALL events on the internal bus using wildcard '*'
        eventBus.subscribe('*', this.handleInternalEvent.bind(this), 'gateway_dispatcher');
        logger.info('[Gateway] RealtimeDispatcher attached to EventBus');
    }

    /**
     * Handles any event emitted on the internal EventBus and routes it to WebSocket clients.
     */
    handleInternalEvent(context) {
        if (!this.io) return;

        const { eventName, payload, guildId, userId } = context;

        // Skip internal gateway events to prevent loops
        if (eventName.startsWith('gateway.')) return;

        const broadcastData = {
            event: eventName,
            data: payload,
            guildId,
            userId,
            timestamp: context.timestamp,
            correlationId: context.correlationId
        };

        // Determine target rooms
        const targetRooms = new Set();
        
        // 1. Exact event name topic
        targetRooms.add(`topic:${eventName}`);
        
        // 2. Global wildcard topic (e.g. if event is 'market.sold', room 'topic:market.*')
        const parts = eventName.split('.');
        if (parts.length > 1) {
            targetRooms.add(`topic:${parts[0]}.*`);
        }

        // 3. Guild specific topics (e.g. 'guild.12345.*' and 'guild.12345.market.*')
        if (guildId) {
            targetRooms.add(`topic:guild.${guildId}.*`);
            if (parts.length > 0) {
                targetRooms.add(`topic:guild.${guildId}.${parts[0]}.*`);
            }
        }

        // Broadcast to all resolved rooms
        const byteSizeEstimate = JSON.stringify(broadcastData).length;

        targetRooms.forEach(room => {
            this.io.to(room).emit('gateway.dispatch', broadcastData);
        });

        // We estimate metrics based on a simple heuristic (not perfect as it doesn't count active subscribers per room directly without expensive calculation, but good enough for tracking throughput)
        realtimeMetrics.messageSent(byteSizeEstimate);
    }
}

module.exports = new RealtimeDispatcher();
