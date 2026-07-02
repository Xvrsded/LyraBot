/**
 * marketplace.js — Marketplace API routes for Module 17.
 * Base: /api/v1/marketplace
 */

const { Router }   = require('express');
const { success, error, paginated } = require('../formatters/apiResponse');
const { requirePermission } = require('../middleware/apiAuthorization');
const { strictLimiter }     = require('../middleware/apiRateLimiter');
const { validate }          = require('../middleware/apiValidator');

const router = Router();

// GET /:guildId/listings — browse active listings
router.get('/:guildId/listings',
    requirePermission('read:market'),
    validate({ query: { sort: 'string|optional', page: 'integer|optional', limit: 'integer|optional' } }),
    async (req, res) => {
        try {
            const { guildId } = req.params;
            const { sort = 'newest' } = req.query;
            const page  = Math.max(1, req.query.page  || 1);
            const limit = Math.min(25, req.query.limit || 10);
            const skip  = (page - 1) * limit;

            const marketplaceSearch = require('../../services/marketplaceSearch');
            const MarketListing     = require('../../models/MarketListing');

            const [results, total] = await Promise.all([
                marketplaceSearch.browse(guildId, { sort, limit, skip }),
                MarketListing.countDocuments({ guildId, status: 'active' })
            ]);

            return res.json(paginated(results, page, limit, total, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// GET /:guildId/listings/:listingId — get single listing
router.get('/:guildId/listings/:listingId',
    requirePermission('read:market'),
    async (req, res) => {
        try {
            const { guildId, listingId } = req.params;
            const listingService = require('../../services/listingService');
            const listing = await listingService.getById(listingId);

            if (!listing || listing.guildId !== guildId) {
                return res.status(404).json(error('NOT_FOUND', `Listing "${listingId}" tidak ditemukan.`, null, req.correlationId));
            }

            const itemRegistry = require('../../services/itemRegistry');
            const itemDef = itemRegistry.get(listing.itemId);

            return res.json(success({ ...listing.toObject(), item: itemDef }, {}, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// POST /:guildId/listings — create listing (sell)
router.post('/:guildId/listings',
    requirePermission('write:market'),
    strictLimiter,
    validate({ body: { sellerId: 'string|required', itemId: 'string|required', quantity: 'integer|optional', pricePerUnit: 'integer|required|min:1' } }),
    async (req, res) => {
        try {
            const { guildId } = req.params;
            const { sellerId, itemId, quantity = 1, pricePerUnit } = req.body;

            const marketplaceEngine = require('../../services/marketplaceEngine');
            const result = await marketplaceEngine.sell(guildId, sellerId, itemId, quantity, pricePerUnit);

            if (!result.success) {
                return res.status(400).json(error('LISTING_FAILED', result.reason, null, req.correlationId));
            }

            return res.status(201).json(success(result.listing, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('LISTING_FAILED', err.message, null, req.correlationId));
        }
    }
);

// POST /:guildId/listings/:listingId/buy — buy a listing
router.post('/:guildId/listings/:listingId/buy',
    requirePermission('write:market'),
    strictLimiter,
    validate({ body: { buyerId: 'string|required' } }),
    async (req, res) => {
        try {
            const { guildId, listingId } = req.params;
            const { buyerId } = req.body;

            const marketplaceEngine = require('../../services/marketplaceEngine');
            const result = await marketplaceEngine.buy(guildId, buyerId, listingId, {
                correlationId: req.correlationId
            });

            if (!result.success) {
                return res.status(400).json(error('BUY_FAILED', result.reason, null, req.correlationId));
            }

            return res.json(success({
                tradeId:    result.tradeId,
                listingId,
                totalPrice: result.totalPrice
            }, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('BUY_FAILED', err.message, null, req.correlationId));
        }
    }
);

// DELETE /:guildId/listings/:listingId — cancel listing
router.delete('/:guildId/listings/:listingId',
    requirePermission('write:market'),
    strictLimiter,
    validate({ body: { sellerId: 'string|required' } }),
    async (req, res) => {
        try {
            const { guildId, listingId } = req.params;
            const { sellerId } = req.body;

            const marketplaceEngine = require('../../services/marketplaceEngine');
            const result = await marketplaceEngine.cancel(guildId, sellerId, listingId);

            if (!result.success) {
                return res.status(400).json(error('CANCEL_FAILED', result.reason, null, req.correlationId));
            }

            return res.json(success({ listingId, status: 'cancelled' }, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('CANCEL_FAILED', err.message, null, req.correlationId));
        }
    }
);

module.exports = router;
