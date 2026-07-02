/**
 * quests.js — Quest API routes for Module 17.
 * Base: /api/v1/quests
 */

const { Router }   = require('express');
const { success, error } = require('../formatters/apiResponse');
const { requirePermission } = require('../middleware/apiAuthorization');

const router = Router();

// GET /:guildId/quests — list all quest definitions
router.get('/:guildId/quests',
    requirePermission('read:quests'),
    async (req, res) => {
        try {
            const questRegistry = require('../../services/questRegistry');
            const quests = questRegistry.getAll();
            return res.json(success(quests, { count: quests.length }, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// GET /:guildId/users/:userId/quests — get user quest progress
router.get('/:guildId/users/:userId/quests',
    requirePermission('read:quests'),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;
            const QuestProgress = require('../../models/QuestProgress');

            const progress = await QuestProgress.find({ guildId, userId })
                .sort({ updatedAt: -1 })
                .limit(50);

            const questRegistry = require('../../services/questRegistry');
            const enriched = progress.map(p => ({
                questId:     p.questId,
                status:      p.status,
                progress:    p.progress,
                goal:        p.goal,
                completedAt: p.completedAt,
                definition:  questRegistry.get(p.questId) || null
            }));

            return res.json(success(enriched, { count: enriched.length }, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

module.exports = router;
