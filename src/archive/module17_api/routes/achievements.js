/**
 * achievements.js — Achievement API routes for Module 17.
 * Base: /api/v1/achievements
 */

const { Router }   = require('express');
const { success, error } = require('../formatters/apiResponse');
const { requirePermission } = require('../middleware/apiAuthorization');

const router = Router();

// GET /:guildId/achievements — list all achievement definitions
router.get('/:guildId/achievements',
    requirePermission('read:achievements'),
    async (req, res) => {
        try {
            const achievementRegistry = require('../../services/achievementRegistry');
            const achievements = achievementRegistry.getAll ? achievementRegistry.getAll() : [];
            return res.json(success(achievements, { count: achievements.length }, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// GET /:guildId/users/:userId/achievements — get user achievement progress
router.get('/:guildId/users/:userId/achievements',
    requirePermission('read:achievements'),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;

            // Try AchievementProgress model if it exists
            let progress = [];
            try {
                const AchievementProgress = require('../../models/AchievementProgress');
                progress = await AchievementProgress.find({ guildId, userId })
                    .sort({ updatedAt: -1 })
                    .limit(100);
            } catch (_) {
                // Model may not exist yet
            }

            const achievementRegistry = require('../../services/achievementRegistry');
            const enriched = progress.map(p => ({
                achievementId: p.achievementId,
                status:        p.status,
                progress:      p.progress,
                unlockedAt:    p.unlockedAt,
                definition:    achievementRegistry.get ? achievementRegistry.get(p.achievementId) : null
            }));

            return res.json(success(enriched, { count: enriched.length }, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

module.exports = router;
