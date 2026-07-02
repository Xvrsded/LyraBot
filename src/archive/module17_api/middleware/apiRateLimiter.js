/**
 * apiRateLimiter.js — Rate limiting middleware for Module 17 API.
 *
 * Tiers:
 *  - global:    1000 req / 15 min  per IP
 *  - perKey:    300  req / 1 min   per API Key
 *  - perGuild:  500  req / 1 min   per guildId
 *  - strict:    30   req / 1 min   per API Key (write operations)
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { error }  = require('../formatters/apiResponse');

function makeRateLimitHandler(code, message) {
    return (req, res) => {
        res.status(429).json(
            error(code, message, {
                retryAfter: res.getHeader('Retry-After')
            }, req.correlationId)
        );
    };
}

/**
 * Global rate limiter — 1000 req / 15 min per IP.
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeRateLimitHandler('RATE_LIMIT_GLOBAL', 'Terlalu banyak permintaan. Coba lagi setelah 15 menit.')
});

/**
 * Per API Key rate limiter — 300 req / 1 min.
 * Falls back to IP if no API key present.
 */
const perKeyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    keyGenerator: (req) => req.headers['x-api-key'] || ipKeyGenerator(req),
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeRateLimitHandler('RATE_LIMIT_KEY', 'Terlalu banyak permintaan per API key. Coba lagi dalam 1 menit.')
});

/**
 * Per Guild rate limiter — 500 req / 1 min.
 * Falls back to IP if no guildId in route.
 */
const perGuildLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 500,
    keyGenerator: (req) => req.params.guildId || ipKeyGenerator(req),
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeRateLimitHandler('RATE_LIMIT_GUILD', 'Terlalu banyak permintaan per guild. Coba lagi dalam 1 menit.')
});

/**
 * Strict limiter for write operations — 30 req / 1 min per API key.
 */
const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.headers['x-api-key'] || ipKeyGenerator(req),
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeRateLimitHandler('RATE_LIMIT_STRICT', 'Terlalu banyak operasi tulis. Coba lagi dalam 1 menit.')
});

module.exports = { globalLimiter, perKeyLimiter, perGuildLimiter, strictLimiter };
