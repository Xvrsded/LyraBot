/**
 * moderation.js — Moderation API routes for Module 17.
 * Base: /api/v1/moderation
 */

const { Router }   = require('express');
const { success, error, paginated } = require('../formatters/apiResponse');
const { requirePermission } = require('../middleware/apiAuthorization');
const { strictLimiter }     = require('../middleware/apiRateLimiter');
const { validate }          = require('../middleware/apiValidator');

const VALID_ACTIONS = ['warn', 'kick', 'ban', 'softban', 'timeout', 'mute', 'unmute', 'unban'];

const router = Router();

// GET /:guildId/cases — list cases (paginated)
router.get('/:guildId/cases',
    requirePermission('read:moderation'),
    validate({ query: { page: 'integer|optional', limit: 'integer|optional', userId: 'string|optional', action: 'string|optional' } }),
    async (req, res) => {
        try {
            const { guildId } = req.params;
            const page   = Math.max(1, req.query.page  || 1);
            const limit  = Math.min(50, req.query.limit || 10);
            const skip   = (page - 1) * limit;

            const query  = { guildId };
            if (req.query.userId) query.targetId = req.query.userId;
            if (req.query.action) query.action   = req.query.action;

            const ModerationCase = require('../../models/ModerationCase');
            const [cases, total] = await Promise.all([
                ModerationCase.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
                ModerationCase.countDocuments(query)
            ]);

            return res.json(paginated(cases, page, limit, total, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// GET /:guildId/cases/:caseId — get single case
router.get('/:guildId/cases/:caseId',
    requirePermission('read:moderation'),
    async (req, res) => {
        try {
            const { guildId, caseId } = req.params;
            const ModerationCase = require('../../models/ModerationCase');
            const modCase = await ModerationCase.findOne({ guildId, caseId });

            if (!modCase) {
                return res.status(404).json(error('NOT_FOUND', `Case "${caseId}" tidak ditemukan.`, null, req.correlationId));
            }

            return res.json(success(modCase, {}, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// POST /:guildId/cases — create moderation action
router.post('/:guildId/cases',
    requirePermission('write:moderation'),
    strictLimiter,
    validate({
        body: {
            action:   'string|required',
            targetId: 'string|required',
            moderatorId: 'string|required',
            reason:   'string|optional'
        }
    }),
    async (req, res) => {
        try {
            const { guildId } = req.params;
            const { action, targetId, moderatorId, reason = 'No reason provided' } = req.body;

            if (!VALID_ACTIONS.includes(action.toLowerCase())) {
                return res.status(400).json(error(
                    'INVALID_ACTION',
                    `Aksi tidak valid. Pilih dari: ${VALID_ACTIONS.join(', ')}.`,
                    null, req.correlationId
                ));
            }

            // Requires ModerationEngine from Module 9
            const moderationEngine = require('../../services/moderationEngine');
            const client = req.app.locals.client;

            const result = await moderationEngine.execute({
                guildId, action, targetId, moderatorId, reason,
                client, correlationId: req.correlationId
            });

            return res.status(201).json(success(result, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('MODERATION_FAILED', err.message, null, req.correlationId));
        }
    }
);

module.exports = router;
