/**
 * inventory.js — Inventory API routes for Module 17.
 * Base: /api/v1/inventory
 */

const { Router }   = require('express');
const { success, error, paginated } = require('../formatters/apiResponse');
const { requirePermission } = require('../middleware/apiAuthorization');
const { strictLimiter }     = require('../middleware/apiRateLimiter');
const { validate }          = require('../middleware/apiValidator');

const router = Router();

// GET /:guildId/users/:userId/inventory
router.get('/:guildId/users/:userId/inventory',
    requirePermission('read:inventory'),
    validate({ query: { page: 'integer|optional', limit: 'integer|optional', sort: 'string|optional' } }),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;
            const page  = Math.max(1, req.query.page  || 1);
            const limit = Math.min(50, req.query.limit || 20);
            const sort  = req.query.sort || 'rarity';

            const inventoryEngine = require('../../services/inventoryEngine');
            const all = await inventoryEngine.sort(guildId, userId, sort);
            const slice = all.slice((page - 1) * limit, page * limit);

            const items = slice.map(({ slot, item }) => ({
                itemId:    slot.itemId,
                quantity:  slot.quantity,
                acquiredAt: slot.acquiredAt,
                name:      item?.name,
                rarity:    item?.rarity,
                category:  item?.category,
                usable:    item?.usable
            }));

            return res.json(paginated(items, page, limit, all.length, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// POST /:guildId/users/:userId/inventory/add
router.post('/:guildId/users/:userId/inventory/add',
    requirePermission('write:inventory'),
    strictLimiter,
    validate({ body: { itemId: 'string|required', quantity: 'integer|optional' } }),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;
            const { itemId, quantity = 1 } = req.body;

            const inventoryService = require('../../services/inventoryService');
            const slot = await inventoryService.add(guildId, userId, itemId, quantity);

            return res.json(success({ itemId, quantity: slot.quantity }, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('INVENTORY_ERROR', err.message, null, req.correlationId));
        }
    }
);

// POST /:guildId/users/:userId/inventory/remove
router.post('/:guildId/users/:userId/inventory/remove',
    requirePermission('write:inventory'),
    strictLimiter,
    validate({ body: { itemId: 'string|required', quantity: 'integer|optional' } }),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;
            const { itemId, quantity = 1 } = req.body;

            const inventoryService = require('../../services/inventoryService');
            await inventoryService.remove(guildId, userId, itemId, quantity);

            return res.json(success({ itemId, removed: quantity }, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('INVENTORY_ERROR', err.message, null, req.correlationId));
        }
    }
);

// POST /:guildId/users/:userId/inventory/use
router.post('/:guildId/users/:userId/inventory/use',
    requirePermission('write:inventory'),
    strictLimiter,
    validate({ body: { itemId: 'string|required' } }),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;
            const { itemId } = req.body;

            const itemUsagePipeline = require('../../services/itemUsagePipeline');
            const result = await itemUsagePipeline.use(guildId, userId, itemId);

            if (!result.success) {
                return res.status(400).json(error('ITEM_USE_FAILED', result.reason, null, req.correlationId));
            }

            return res.json(success({
                itemId,
                itemName:    result.item?.name,
                effectsApplied: result.applied,
                effectsFailed:  result.failed
            }, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('ITEM_USE_FAILED', err.message, null, req.correlationId));
        }
    }
);

module.exports = router;
