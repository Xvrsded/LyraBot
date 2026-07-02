/**
 * gatewayAuth.js — Authentication middleware for Socket.IO (Module 18)
 * Checks API Key or JWT during handshake.
 */

const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');

const MASTER_KEY = process.env.API_MASTER_KEY || 'dev-master-key-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const BOT_TOKEN = process.env.TOKEN || '';

/**
 * Socket.IO middleware to authenticate connection handshake.
 * Assigns `socket.user` if valid, otherwise passes error to `next()`.
 */
function authenticateSocket(socket, next) {
    const auth = socket.handshake.auth || {};
    const headers = socket.handshake.headers || {};

    const apiKey = auth.apiKey || headers['x-api-key'];
    const token = auth.token || headers['authorization'];

    try {
        // 1. API Key Auth
        if (apiKey) {
            if (apiKey === MASTER_KEY) {
                socket.user = { id: 'master', role: 'MASTER', guildId: null, permissions: ['*'] };
                return next();
            }
            return next(new Error('API_KEY_INVALID'));
        }

        // 2. Bot Token Auth
        if (token && token.startsWith('Bot ')) {
            const botToken = token.slice(4).trim();
            if (botToken === BOT_TOKEN) {
                socket.user = { id: 'bot', role: 'MASTER', guildId: null, permissions: ['*'] };
                return next();
            }
            return next(new Error('BOT_TOKEN_INVALID'));
        }

        // 3. JWT Auth
        if (token && token.startsWith('Bearer ')) {
            const jwtToken = token.slice(7).trim();
            const payload = jwt.verify(jwtToken, JWT_SECRET);
            socket.user = {
                id: payload.sub || payload.id,
                role: payload.role || 'READ_ONLY',
                guildId: payload.guildId || null,
                permissions: payload.permissions || []
            };
            return next();
        }

        return next(new Error('NO_AUTH'));
    } catch (err) {
        logger.error('[GatewayAuth] Handshake authentication failed:', err.message);
        return next(new Error('AUTH_ERROR'));
    }
}

module.exports = { authenticateSocket };
