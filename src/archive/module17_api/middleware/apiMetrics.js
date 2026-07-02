/**
 * apiMetrics.js — Request metrics collection middleware for Module 17.
 *
 * Tracks per-route: requestCount, errorCount, totalLatencyMs, avgLatencyMs, bandwidth.
 * Exposes getMetrics() for the /metrics endpoint.
 */

const logger = require('../../utils/logger');

/** @type {Map<string, object>} routeKey → metrics object */
const metricsStore = new Map();

let totalRequests = 0;
let totalErrors   = 0;
let totalBandwidth = 0;

/**
 * Express middleware that intercepts every request and records metrics.
 */
function metricsMiddleware(req, res, next) {
    const startMs = Date.now();
    totalRequests++;

    // Hook into response finish to capture latency, status, and bandwidth
    res.on('finish', () => {
        const latency = Date.now() - startMs;
        const route   = `${req.method}:${req.route?.path || req.path}`;
        const isError = res.statusCode >= 400;
        const bytes   = Number(res.getHeader('Content-Length') || 0);

        if (isError) totalErrors++;
        totalBandwidth += bytes;

        let entry = metricsStore.get(route);
        if (!entry) {
            entry = { requestCount: 0, errorCount: 0, totalLatencyMs: 0, avgLatencyMs: 0, bandwidth: 0 };
            metricsStore.set(route, entry);
        }

        entry.requestCount++;
        if (isError) entry.errorCount++;
        entry.totalLatencyMs += latency;
        entry.avgLatencyMs    = Math.round(entry.totalLatencyMs / entry.requestCount);
        entry.bandwidth      += bytes;
    });

    next();
}

/**
 * Returns a snapshot of all collected metrics.
 */
function getMetrics() {
    const routes = {};
    for (const [key, val] of metricsStore.entries()) {
        routes[key] = { ...val };
    }
    return {
        summary: {
            totalRequests,
            totalErrors,
            errorRate: totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) + '%' : '0%',
            totalBandwidthBytes: totalBandwidth,
            uptimeSecs: Math.round(process.uptime())
        },
        routes
    };
}

/**
 * Resets all metrics (useful for testing).
 */
function resetMetrics() {
    metricsStore.clear();
    totalRequests = 0;
    totalErrors   = 0;
    totalBandwidth = 0;
}

module.exports = { metricsMiddleware, getMetrics, resetMetrics };
