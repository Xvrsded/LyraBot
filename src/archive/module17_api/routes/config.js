/**
 * config.js — Guild configuration API routes for Module 17.
 * Base: /api/v1/config
 */

const { Router }   = require('express');
const { success, error } = require('../formatters/apiResponse');
const { requirePermission } = require('../middleware/apiAuthorization');
const { strictLimiter }     = require('../middleware/apiRateLimiter');
const { validate }          = require('../middleware/apiValidator');

const router = Router();

// GET /:guildId/config — get all config values
router.get('/:guildId/config',
    requirePermission('read:config'),
    async (req, res) => {
        try {
            const { guildId } = req.params;
            const configService = require('../../services/configService');
            const config = await configService.getAll(guildId);
            return res.json(success(config, {}, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// GET /:guildId/config/:key — get specific config value
router.get('/:guildId/config/:key',
    requirePermission('read:config'),
    async (req, res) => {
        try {
            const { guildId, key } = req.params;
            const configService = require('../../services/configService');
            const value = await configService.get(guildId, key);

            if (value === undefined || value === null) {
                return res.status(404).json(error('NOT_FOUND', `Config key "${key}" tidak ditemukan.`, null, req.correlationId));
            }

            return res.json(success({ key, value }, {}, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// POST /:guildId/config — update config values (ADMIN only)
router.post('/:guildId/config',
    requirePermission('write:config'),
    strictLimiter,
    validate({ body: { key: 'string|required', value: 'string|required' } }),
    async (req, res) => {
        try {
            const { guildId } = req.params;
            const { key, value } = req.body;

            const configService = require('../../services/configService');
            await configService.set(guildId, key, value);

            return res.json(success({ key, value, updated: true }, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('CONFIG_UPDATE_FAILED', err.message, null, req.correlationId));
        }
    }
);

module.exports = router;
