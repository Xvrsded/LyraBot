const MarketListing = require('../models/MarketListing');
const itemRegistry  = require('./itemRegistry');
const logger        = require('../utils/logger');

const SORT_MAP = {
    newest:     { createdAt: -1 },
    oldest:     { createdAt:  1 },
    price_asc:  { pricePerUnit:  1 },
    price_desc: { pricePerUnit: -1 }
};

class MarketplaceSearch {
    /**
     * Paginates active listings with optional sort.
     * @param {string} guildId
     * @param {object} options { sort, limit, skip, featured }
     * @returns {Promise<object[]>} Enriched listings
     */
    async browse(guildId, options = {}) {
        const sort  = SORT_MAP[options.sort] || SORT_MAP.newest;
        const limit = Math.min(options.limit  || 10, 25);
        const skip  = options.skip || 0;

        const query = { guildId, status: 'active' };
        if (options.featured) query.featured = true;

        const listings = await MarketListing.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        return this._enrich(listings);
    }

    /**
     * Searches active listings by item name, description, or category keyword.
     * @param {string} guildId
     * @param {string} keyword
     * @param {number} limit
     * @returns {Promise<object[]>} Enriched listings matching keyword
     */
    async search(guildId, keyword, limit = 15) {
        const q = (keyword || '').toLowerCase().trim();
        if (!q) return this.browse(guildId, { limit });

        const listings = await MarketListing.find({ guildId, status: 'active' }).limit(100);
        const filtered = listings.filter(l => {
            const def = itemRegistry.get(l.itemId);
            if (!def) return false;
            return (
                def.name.toLowerCase().includes(q) ||
                (def.description || '').toLowerCase().includes(q) ||
                def.category.toLowerCase().includes(q)
            );
        });

        return this._enrich(filtered.slice(0, limit));
    }

    /**
     * Filters active listings by category, rarity, price range, or sellerId.
     * @param {string} guildId
     * @param {object} filters { category, rarity, minPrice, maxPrice, sellerId, sort }
     * @returns {Promise<object[]>} Enriched filtered listings
     */
    async filter(guildId, filters = {}) {
        const { category, rarity, minPrice, maxPrice, sellerId, sort } = filters;

        const query = { guildId, status: 'active' };
        if (sellerId) query.sellerId = sellerId;
        if (minPrice) query.pricePerUnit = { ...query.pricePerUnit, $gte: minPrice };
        if (maxPrice) query.pricePerUnit = { ...query.pricePerUnit, $lte: maxPrice };

        const dbSort = SORT_MAP[sort] || SORT_MAP.newest;
        let listings = await MarketListing.find(query).sort(dbSort).limit(50);

        // Post-filter by registry fields (category, rarity)
        if (category || rarity) {
            listings = listings.filter(l => {
                const def = itemRegistry.get(l.itemId);
                if (!def) return false;
                if (category && def.category !== category) return false;
                if (rarity   && def.rarity   !== rarity)   return false;
                return true;
            });
        }

        return this._enrich(listings);
    }

    /**
     * Enriches listing documents with item registry metadata.
     * @private
     */
    _enrich(listings) {
        return listings.map(l => {
            const plain = l.toObject ? l.toObject() : { ...l };
            return {
                ...plain,
                item: itemRegistry.get(l.itemId) || null
            };
        });
    }
}

module.exports = new MarketplaceSearch();
