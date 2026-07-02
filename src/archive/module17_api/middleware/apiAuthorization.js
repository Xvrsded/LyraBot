/**
 * apiAuthorization.js — RBAC authorization middleware for Module 17 API.
 *
 * Role hierarchy: MASTER (100) > ADMIN (80) > MODERATOR (60) > READ_ONLY (20)
 *
 * Guild isolation: when a route includes :guildId param,
 * non-MASTER users may only access their own guild's data.
 */

const { error } = require('../formatters/apiResponse');

const ROLE_LEVEL = {
    MASTER:     100,
    ADMIN:      80,
    MODERATOR:  60,
    READ_ONLY:  20
};

/**
 * Permission policies map.
 * Key = permission name, Value = minimum role level required.
 */
const PERMISSION_POLICIES = {
    // Economy
    'read:economy':    ROLE_LEVEL.READ_ONLY,
    'write:economy':   ROLE_LEVEL.ADMIN,

    // Inventory
    'read:inventory':  ROLE_LEVEL.READ_ONLY,
    'write:inventory': ROLE_LEVEL.ADMIN,

    // Marketplace
    'read:market':     ROLE_LEVEL.READ_ONLY,
    'write:market':    ROLE_LEVEL.ADMIN,

    // Quests & Achievements
    'read:quests':     ROLE_LEVEL.READ_ONLY,
    'read:achievements': ROLE_LEVEL.READ_ONLY,

    // Moderation
    'read:moderation': ROLE_LEVEL.MODERATOR,
    'write:moderation': ROLE_LEVEL.MODERATOR,

    // Audit
    'read:audit':      ROLE_LEVEL.ADMIN,

    // Config
    'read:config':     ROLE_LEVEL.READ_ONLY,
    'write:config':    ROLE_LEVEL.ADMIN,

    // Profile
    'read:profile':    ROLE_LEVEL.READ_ONLY,

    // Metrics (MASTER only)
    'read:metrics':    ROLE_LEVEL.MASTER,

    // Wildcard
    '*':               ROLE_LEVEL.MASTER
};

/**
 * Returns an Express middleware that enforces a specific permission.
 * @param {string} permission  e.g. 'read:economy'
 */
function requirePermission(permission) {
    return (req, res, next) => {
        const user = req.apiUser;

        // No authenticated user
        if (!user) {
            return res.status(401).json(
                error('UNAUTHENTICATED', 'Autentikasi diperlukan.', null, req.correlationId)
            );
        }

        // MASTER bypasses all permission checks
        if (user.role === 'MASTER' || (user.permissions && user.permissions.includes('*'))) {
            return _enforceGuildIsolation(req, res, next, user);
        }

        // Check role level against policy
        const userLevel   = ROLE_LEVEL[user.role] ?? 0;
        const required    = PERMISSION_POLICIES[permission] ?? ROLE_LEVEL.MASTER;

        if (userLevel < required) {
            return res.status(403).json(
                error('FORBIDDEN', `Izin tidak mencukupi. Diperlukan: ${_roleNameFor(required)}.`, null, req.correlationId)
            );
        }

        // Check explicit permissions array if role level passes
        if (user.permissions && user.permissions.length > 0 &&
            !user.permissions.includes('*') && !user.permissions.includes(permission)) {
            return res.status(403).json(
                error('FORBIDDEN', `Izin "${permission}" tidak diberikan.`, null, req.correlationId)
            );
        }

        return _enforceGuildIsolation(req, res, next, user);
    };
}

/**
 * Enforces guild isolation: non-MASTER users cannot access other guilds.
 * @private
 */
function _enforceGuildIsolation(req, res, next, user) {
    const routeGuildId = req.params.guildId;

    // No guildId in route — skip isolation check
    if (!routeGuildId) return next();

    // MASTER has access to all guilds
    if (user.role === 'MASTER') return next();

    // Guild-scoped users must match
    if (user.guildId && user.guildId !== routeGuildId) {
        return res.status(403).json(
            error('GUILD_ISOLATION', 'Akses ke guild lain tidak diizinkan.', null, req.correlationId)
        );
    }

    return next();
}

function _roleNameFor(level) {
    return Object.keys(ROLE_LEVEL).find(k => ROLE_LEVEL[k] === level) || String(level);
}

module.exports = { requirePermission, ROLE_LEVEL, PERMISSION_POLICIES };
