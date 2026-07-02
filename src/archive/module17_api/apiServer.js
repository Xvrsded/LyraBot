/**
 * apiServer.js — Main API server for Module 17: Enterprise Service API Framework.
 *
 * Initializes Express app with security headers, CORS, JSON parsing,
 * mounts all routes via RouteRegistry, and manages server lifecycle.
 *
 * Usage (from ready.js):
 *   const apiServer = require('../api/apiServer');
 *   apiServer.start(client);
 */

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const http     = require('http');
const logger   = require('../utils/logger');

const { mountRoutes }    = require('./routeRegistry');
const apiAuth            = require('./middleware/apiAuth');
const apiAuthorization   = require('./middleware/apiAuthorization');
const apiRateLimiter     = require('./middleware/apiRateLimiter');
const apiMetrics         = require('./middleware/apiMetrics');
const apiResponse        = require('./formatters/apiResponse');
const openApiSpec        = require('./openapi/spec');

const API_PORT    = parseInt(process.env.API_PORT || '3000', 10);
const CORS_ORIGIN = process.env.API_CORS_ORIGIN || '*';
const BASE_PATH   = '/api/v1';

let httpServer = null;

/**
 * Starts the API server, binding it to the bot client.
 * @param {Client} client  The Discord.js client (stored in app.locals)
 */
function start(client) {
    const app = express();

    // ── Security headers ──────────────────────────────────────────────────────
    app.use(helmet({
        contentSecurityPolicy: false  // Disable CSP for API (JSON only responses)
    }));

    // ── CORS ──────────────────────────────────────────────────────────────────
    app.use(cors({
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Correlation-ID']
    }));

    // ── JSON body parsing ─────────────────────────────────────────────────────
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: false }));

    // ── Store Discord client for route handlers ────────────────────────────────
    app.locals.client = client;

    // ── Mount all routes via registry ─────────────────────────────────────────
    mountRoutes(app, BASE_PATH, {
        apiAuth,
        apiAuthorization,
        apiRateLimiter,
        apiMetrics,
        apiResponse,
        openApiSpec: { generateSpec: openApiSpec.generateSpec }
    });

    // ── 404 handler ────────────────────────────────────────────────────────────
    app.use((req, res) => {
        res.status(404).json(apiResponse.error(
            'NOT_FOUND',
            `Endpoint ${req.method} ${req.path} tidak ditemukan.`,
            null,
            req.correlationId
        ));
    });

    // ── Global error handler ──────────────────────────────────────────────────
    app.use((err, req, res, _next) => {
        logger.error('[ApiServer] Unhandled error:', err.message);
        res.status(500).json(apiResponse.error(
            'INTERNAL_ERROR',
            'Kesalahan server internal.',
            process.env.NODE_ENV !== 'production' ? { stack: err.message } : null,
            req.correlationId
        ));
    });

    // ── Start listening ───────────────────────────────────────────────────────
    httpServer = http.createServer(app);
    httpServer.listen(API_PORT, () => {
        logger.info(`[ApiServer] ✅ API Server started on http://localhost:${API_PORT}${BASE_PATH}`);
        logger.info(`[ApiServer] 📖 Docs: http://localhost:${API_PORT}${BASE_PATH}/docs`);
    });

    httpServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger.error(`[ApiServer] Port ${API_PORT} already in use. API server not started.`);
        } else {
            logger.error('[ApiServer] Server error:', err.message);
        }
    });

    return httpServer;
}

/**
 * Gracefully stops the HTTP server.
 */
function stop() {
    if (httpServer) {
        httpServer.close(() => logger.info('[ApiServer] API Server stopped.'));
        httpServer = null;
    }
}

/**
 * Returns the raw http.Server instance (useful for testing).
 */
function getServer() {
    return httpServer;
}

module.exports = { start, stop, getServer };
