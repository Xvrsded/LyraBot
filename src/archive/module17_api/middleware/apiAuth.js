/**
 * apiAuth.js — Authentication middleware for Module 17 API.
 *
 * Supports 3 modes (checked in order):
 *  1. X-API-Key header  → master key or guild-scoped key
 *  2. Authorization: Bot <token>  → matches BOT TOKEN
 *  3. Authorization: Bearer <jwt> → JWT verification
 */

const jwt     = require('jsonwebtoken');
const { error } = require('../formatters/apiResponse');
const logger  = require('../../utils/logger');

const MASTER_KEY = process.env.API_MASTER_KEY || 'dev-master-key-change-in-production';
const BOT_TOKEN  = process.env.TOKEN || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

/**
 * Role hierarchy (higher = more permissions)
 */
const ROLES = {
    MASTER:     100,
    ADMIN:      80,
    MODERATOR:  60,
    READ_ONLY:  20
};

/**
 * Authentication middleware.
 * Attaches req.apiUser = { id, role, guildId, permissions[] } on success.
 */
async function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'] || '';

    try {
        // ── Mode 1: API Key ─────────────────────────────────────────────────
        if (apiKey) {
            const user = await _verifyApiKey(apiKey, req);
            if (user) {
                req.apiUser = user;
                logger.info(`[ApiAuth] API Key auth: role=${user.role} guild=${user.guildId || 'global'}`);
                return next();
            }
            return _unauthorized(res, req, 'API_KEY_INVALID', 'API key tidak valid.');
        }

        // ── Mode 2: Bot Token ───────────────────────────────────────────────
        if (authHeader.startsWith('Bot ')) {
            const token = authHeader.slice(4).trim();
            if (token === BOT_TOKEN) {
                req.apiUser = { id: 'bot', role: 'MASTER', guildId: null, permissions: ['*'] };
                logger.info('[ApiAuth] Bot Token auth accepted.');
                return next();
            }
            return _unauthorized(res, req, 'BOT_TOKEN_INVALID', 'Bot token tidak valid.');
        }

        // ── Mode 3: JWT Bearer ──────────────────────────────────────────────
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            try {
                const payload = jwt.verify(token, JWT_SECRET);
                req.apiUser = {
                    id:          payload.sub || payload.id,
                    role:        payload.role || 'READ_ONLY',
                    guildId:     payload.guildId || null,
                    permissions: payload.permissions || []
                };
                logger.info(`[ApiAuth] JWT auth: sub=${req.apiUser.id} role=${req.apiUser.role}`);
                return next();
            } catch (jwtErr) {
                return _unauthorized(res, req, 'JWT_INVALID', `JWT tidak valid: ${jwtErr.message}`);
            }
        }

        // No auth provided
        return _unauthorized(res, req, 'NO_AUTH', 'Autentikasi diperlukan. Sertakan X-API-Key atau Authorization header.');

    } catch (err) {
        logger.error('[ApiAuth] Authentication error:', err.message);
        return res.status(500).json(
            error('AUTH_ERROR', 'Kesalahan internal autentikasi.', null, req.correlationId)
        );
    }
}

/**
 * Verifies an API key.
 * Currently supports: master key (global), or keys stored in future DB.
 * @private
 */
async function _verifyApiKey(apiKey, req) {
    // Master key — full access, no guild restriction
    if (apiKey === MASTER_KEY) {
        return {
            id: 'master',
            role: 'MASTER',
            guildId: null,
            permissions: ['*']
        };
    }

    // Future: look up guild-scoped API keys from MongoDB
    // const ApiKey = require('../../models/ApiKey');
    // const record = await ApiKey.findOne({ key: apiKey, active: true });
    // if (record) return { id: record.id, role: record.role, guildId: record.guildId, permissions: record.permissions };

    return null;
}

/**
 * Signs a JWT token for a given user payload.
 * Used by auth routes to issue tokens.
 */
function signJwt(payload, expiresIn = '24h') {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verifies a JWT token and returns its payload.
 */
function verifyJwt(token) {
    return jwt.verify(token, JWT_SECRET);
}

function _unauthorized(res, req, code, message) {
    return res.status(401).json(error(code, message, null, req.correlationId));
}

module.exports = { authenticate, signJwt, verifyJwt, ROLES };
