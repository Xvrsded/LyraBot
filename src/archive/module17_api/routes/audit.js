/**
 * audit.js — Audit log API routes for Module 17.
 * Base: /api/v1/audit
 */

const { Router }   = require('express');
const { success, error, paginated } = require('../formatters/apiResponse');
const { requirePermission } = require('../middleware/apiAuthorization');
const { validate }          = require('../middleware/apiValidator');

const router = Router();

// GET /:guildId/audit — paginated audit entries with optional filters
router.get('/:guildId/audit',
    requirePermission('read:audit'),
    validate({
        query: {
            page:     'integer|optional',
            limit:    'integer|optional',
            plugin:   'string|optional',
            severity: 'string|optional',
            userId:   'string|optional'
        }
    }),
    async (req, res) => {
        try {
            const { guildId } = req.params;
            const page  = Math.max(1, req.query.page  || 1);
            const limit = Math.min(100, req.query.limit || 20);
            const skip  = (page - 1) * limit;

            const query = { guildId };
            if (req.query.plugin)   query.plugin   = req.query.plugin;
            if (req.query.severity) query.severity = req.query.severity;
            if (req.query.userId)   query.userId   = req.query.userId;

            const AuditEntry = require('../../models/AuditEntry');
            const [entries, total] = await Promise.all([
                AuditEntry.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
                AuditEntry.countDocuments(query)
            ]);

            return res.json(paginated(entries, page, limit, total, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

module.exports = router;
