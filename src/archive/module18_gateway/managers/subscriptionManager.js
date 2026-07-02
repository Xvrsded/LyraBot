/**
 * subscriptionManager.js — Manages topic subscriptions using Socket.IO rooms (Module 18)
 */

const logger = require('../../utils/logger');

class SubscriptionManager {
    /**
     * Checks if a user is allowed to subscribe to a specific topic.
     * Enforces guild isolation.
     */
    canSubscribe(user, topic) {
        if (user.role === 'MASTER' || (user.permissions && user.permissions.includes('*'))) {
            return true;
        }
        
        // If topic is guild specific (e.g. guild.12345.*), verify guildId
        if (topic.startsWith('guild.')) {
            const topicGuild = topic.split('.')[1];
            if (user.guildId && user.guildId !== topicGuild) {
                return false;
            }
        }
        
        // By default allow other topics (could be expanded based on role)
        return true;
    }

    /**
     * Handles a SUBSCRIBE request from a client socket.
     */
    handleSubscribe(socket, topic) {
        if (!topic || typeof topic !== 'string') {
            socket.emit('gateway.error', { code: 'INVALID_TOPIC', message: 'Topic is required and must be a string' });
            return;
        }

        if (!this.canSubscribe(socket.user, topic)) {
            socket.emit('gateway.error', { code: 'FORBIDDEN', message: `Cannot subscribe to topic: ${topic}` });
            return;
        }

        const room = `topic:${topic}`;
        socket.join(room);
        logger.debug(`[Gateway] Socket ${socket.id} subscribed to ${room}`);
        socket.emit('gateway.subscribed', { topic });
    }

    /**
     * Handles an UNSUBSCRIBE request from a client socket.
     */
    handleUnsubscribe(socket, topic) {
        if (!topic || typeof topic !== 'string') {
            socket.emit('gateway.error', { code: 'INVALID_TOPIC', message: 'Topic is required and must be a string' });
            return;
        }

        const room = `topic:${topic}`;
        socket.leave(room);
        logger.debug(`[Gateway] Socket ${socket.id} unsubscribed from ${room}`);
        socket.emit('gateway.unsubscribed', { topic });
    }
}

module.exports = new SubscriptionManager();
