/**
 * routeRegistry.js — Auto-discovers and mounts all API route files for Module 17.
 *
 * Convention:
 *  - Each file in src/api/routes/*.js becomes a mounted router.
 *  - The filename (without extension) becomes the URL prefix.
 *  - e.g. economy.js → /api/v1/economy
 *
 * Special built-in routes (not in routes/ dir):
 *  - GET /api/v1/docs     → OpenAPI specification (public)
 *  - GET /api/v1/metrics  → Metrics snapshot (MASTER only)
 *  - GET /api/v1/health   → Health check (public)
 */

const fs      = require('fs');
const path    = require('path');
const logger  = require('../utils/logger');

const ROUTES_DIR = path.join(__dirname, 'routes');

/**
 * Mounts all discovered routes onto the Express app.
 * Also registers built-in system endpoints.
 *
 * @param {Express} app       The Express app instance
 * @param {string}  basePath  The base API path, e.g. '/api/v1'
 * @param {object}  deps      Extra dependencies: { apiAuth, apiMetrics, ... }
 */
function mountRoutes(app, basePath, deps) {
    const { authenticate } = deps.apiAuth;
    const { metricsMiddleware, getMetrics } = deps.apiMetrics;
    const { requirePermission } = deps.apiAuthorization;
    const { generateSpec } = deps.openApiSpec;
    const { attachCorrelationId } = deps.apiResponse;
    const { globalLimiter, perKeyLimiter, perGuildLimiter } = deps.apiRateLimiter;
    const { success } = deps.apiResponse;

    // ── Global middleware (applied to ALL routes under basePath) ──────────────
    app.use(basePath, attachCorrelationId);
    app.use(basePath, metricsMiddleware);
    app.use(basePath, globalLimiter);

    // ── Public system routes (no auth) ────────────────────────────────────────
    app.get(`${basePath}/health`, (req, res) => {
        res.json(success({
            status:     'ok',
            version:    'v1',
            uptimeSecs: Math.round(process.uptime())
        }, {}, req.correlationId));
    });

    app.get(`${basePath}/docs`, (req, res) => {
        res.json(generateSpec());
    });

    // ── Protected system routes ───────────────────────────────────────────────
    app.get(`${basePath}/metrics`,
        authenticate,
        requirePermission('read:metrics'),
        (req, res) => {
            res.json(success(getMetrics(), {}, req.correlationId));
        }
    );

    // ── Module 19: Enterprise Dashboard Backend ──────────────────────────────
    try {
        const dashboardRoutes = require('../dashboard/dashboardRoutes');
        app.use(`${basePath}/dashboard`, dashboardRoutes);
        logger.info(`[RouteRegistry] Mounted Dashboard Backend at ${basePath}/dashboard`);
    } catch (err) {
        logger.warn('[RouteRegistry] Dashboard routes not mounted:', err.message);
    }

    // ── Auto-discover and mount route files ───────────────────────────────────
    let routeFiles;
    try {
        routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));
    } catch (err) {
        logger.error('[RouteRegistry] Cannot read routes directory:', err.message);
        return;
    }

    for (const file of routeFiles) {
        const routeName = path.basename(file, '.js');
        const routePath = `${basePath}/${routeName}`;

        try {
            const router = require(path.join(ROUTES_DIR, file));
            // All discovered routes require authentication + per-key rate limiting
            app.use(routePath, authenticate, perKeyLimiter, perGuildLimiter, router);
            logger.info(`[RouteRegistry] Mounted: ${routePath} ← ${file}`);
        } catch (err) {
            logger.error(`[RouteRegistry] Failed to mount ${file}:`, err.message);
        }
    }

    logger.info(`[RouteRegistry] ${routeFiles.length} route files mounted under ${basePath}`);
}

module.exports = { mountRoutes };
