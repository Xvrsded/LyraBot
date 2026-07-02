/**
 * apiResponse.js — Centralized API response formatter for Module 17.
 * All routes MUST use these helpers — no ad-hoc JSON responses.
 */

const { v4: uuidv4 } = (() => {
    // Inline simple UUID v4 (no dependency needed)
    const fn = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return { v4: fn };
})();

/**
 * Attaches a correlationId to every request.
 */
function attachCorrelationId(req, _res, next) {
    req.correlationId = req.headers['x-correlation-id'] || `req-${uuidv4()}`;
    next();
}

/**
 * Builds a standardized success response body.
 * @param {object} data  The response payload
 * @param {object} [meta] Optional extra metadata
 * @param {string} [correlationId]
 */
function success(data, meta = {}, correlationId = null) {
    return {
        success: true,
        data,
        meta: { version: 'v1', ...meta },
        correlationId,
        timestamp: new Date().toISOString()
    };
}

/**
 * Builds a standardized error response body.
 * @param {string} code    Machine-readable error code (e.g. "INSUFFICIENT_FUNDS")
 * @param {string} message Human-readable message
 * @param {object} [details] Optional extra diagnostic info
 * @param {string} [correlationId]
 */
function error(code, message, details = null, correlationId = null) {
    const body = {
        success: false,
        error: { code, message },
        correlationId,
        timestamp: new Date().toISOString()
    };
    if (details) body.error.details = details;
    return body;
}

/**
 * Builds a paginated success response.
 * @param {Array}  items
 * @param {number} page    Current page (1-indexed)
 * @param {number} limit   Items per page
 * @param {number} total   Total item count across all pages
 * @param {string} [correlationId]
 */
function paginated(items, page, limit, total, correlationId = null) {
    return success({
        items,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    }, {}, correlationId);
}

module.exports = { success, error, paginated, attachCorrelationId };
