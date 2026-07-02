const MarketListing = require('../models/MarketListing');
const eventBus      = require('./eventBus');
const logger        = require('../utils/logger');

class ListingService {
    /**
     * Creates a new marketplace listing.
     * @param {string} guildId
     * @param {string} sellerId
     * @param {string} itemId
     * @param {number} qty
     * @param {number} pricePerUnit
     * @param {string} escrowId  ID of the escrow holding the item
     * @param {Date|null} expiresAt
     * @returns {Promise<Document>} The created MarketListing document
     */
    async create(guildId, sellerId, itemId, qty, pricePerUnit, escrowId, expiresAt = null) {
        const listingId  = `lst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const totalPrice = qty * pricePerUnit;

        const listing = await MarketListing.create({
            listingId, guildId, sellerId,
            itemId, quantity: qty, pricePerUnit, totalPrice,
            escrowId, expiresAt
        });

        eventBus.emit('market.listed',
            { sellerId, itemId, qty, pricePerUnit, totalPrice, listingId },
            { plugin: 'marketplace', guildId, userId: sellerId }
        );

        logger.info(`[ListingService] Created listing ${listingId}: ${qty}x "${itemId}" @ ${pricePerUnit} coins`);
        return listing;
    }

    /**
     * Gets a listing by its unique listingId.
     * @returns {Promise<Document|null>}
     */
    async getById(listingId) {
        return MarketListing.findOne({ listingId });
    }

    /**
     * Gets all active listings in a guild, optionally filtered.
     * @param {string} guildId
     * @param {object} filters  { itemId, sellerId, featured }
     * @param {number} limit
     * @returns {Promise<Document[]>}
     */
    async getActive(guildId, filters = {}, limit = 20) {
        const query = { guildId, status: 'active', ...filters };
        return MarketListing.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    /**
     * Marks a listing as sold and records the buyer.
     * @param {string} listingId
     * @param {string} buyerId
     * @returns {Promise<Document>}
     */
    async markSold(listingId, buyerId) {
        const listing = await MarketListing.findOne({ listingId });
        if (!listing) throw new Error(`Listing "${listingId}" tidak ditemukan.`);

        listing.status  = 'sold';
        listing.buyerId = buyerId;
        listing.soldAt  = new Date();
        await listing.save();

        logger.info(`[ListingService] Listing ${listingId} sold to ${buyerId}`);
        return listing;
    }

    /**
     * Cancels a listing.
     * @param {string} listingId
     * @returns {Promise<Document>}
     */
    async cancel(listingId) {
        const listing = await MarketListing.findOne({ listingId });
        if (!listing) throw new Error(`Listing "${listingId}" tidak ditemukan.`);

        listing.status = 'cancelled';
        await listing.save();

        eventBus.emit('market.cancelled',
            { sellerId: listing.sellerId, listingId, itemId: listing.itemId },
            { plugin: 'marketplace', guildId: listing.guildId, userId: listing.sellerId }
        );

        logger.info(`[ListingService] Listing ${listingId} cancelled`);
        return listing;
    }

    /**
     * Marks a listing as expired.
     * @param {string} listingId
     * @returns {Promise<Document>}
     */
    async expire(listingId) {
        const listing = await MarketListing.findOne({ listingId });
        if (!listing || listing.status !== 'active') return null;

        listing.status = 'expired';
        await listing.save();

        eventBus.emit('market.expired',
            { sellerId: listing.sellerId, listingId, itemId: listing.itemId },
            { plugin: 'marketplace', guildId: listing.guildId, userId: listing.sellerId }
        );

        logger.info(`[ListingService] Listing ${listingId} expired`);
        return listing;
    }

    /**
     * Finds and expires all overdue active listings in a guild.
     * Returns the list of expired listing documents for escrow cleanup.
     * @param {string} guildId
     * @returns {Promise<Document[]>}
     */
    async expireOld(guildId) {
        const now  = new Date();
        const overdue = await MarketListing.find({
            guildId, status: 'active',
            expiresAt: { $ne: null, $lte: now }
        });

        const expired = [];
        for (const listing of overdue) {
            listing.status = 'expired';
            await listing.save();
            eventBus.emit('market.expired',
                { sellerId: listing.sellerId, listingId: listing.listingId, itemId: listing.itemId },
                { plugin: 'marketplace', guildId, userId: listing.sellerId }
            );
            expired.push(listing);
        }

        if (expired.length > 0) {
            logger.info(`[ListingService] Expired ${expired.length} overdue listings in guild ${guildId}`);
        }
        return expired;
    }
}

module.exports = new ListingService();
