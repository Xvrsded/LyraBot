const MarketListing = require('../models/MarketListing');
const TradeHistory  = require('../models/TradeHistory');
const itemRegistry  = require('./itemRegistry');
const logger        = require('../utils/logger');

class MarketplaceStatistics {
    /**
     * Gets the most sold items in a guild from TradeHistory.
     * @param {string} guildId
     * @param {number} limit
     * @returns {Promise<object[]>}
     */
    async getMostSoldItems(guildId, limit = 5) {
        try {
            const results = await TradeHistory.aggregate([
                { $match: { guildId } },
                { $group: { _id: '$itemId', soldCount: { $sum: '$quantity' }, tradeCount: { $sum: 1 } } },
                { $sort: { soldCount: -1 } },
                { $limit: limit }
            ]);
            return results.map(r => ({
                itemId: r._id, soldCount: r.soldCount, tradeCount: r.tradeCount,
                item: itemRegistry.get(r._id)
            }));
        } catch (err) {
            logger.error('[MarketplaceStatistics] getMostSoldItems error:', err.message);
            return [];
        }
    }

    /**
     * Gets the single highest-priced trade ever completed.
     * @param {string} guildId
     * @returns {Promise<object|null>}
     */
    async getHighestPrice(guildId) {
        try {
            const result = await TradeHistory.findOne({ guildId })
                .sort({ totalPrice: -1 })
                .limit(1);
            if (!result) return null;
            return { ...result.toObject(), item: itemRegistry.get(result.itemId) };
        } catch (err) {
            logger.error('[MarketplaceStatistics] getHighestPrice error:', err.message);
            return null;
        }
    }

    /**
     * Gets the average price per unit for a specific item across all trades.
     * @param {string} guildId
     * @param {string} itemId
     * @returns {Promise<number>} Average pricePerUnit, or 0 if no data
     */
    async getAveragePrice(guildId, itemId) {
        try {
            const result = await TradeHistory.aggregate([
                { $match: { guildId, itemId } },
                { $group: { _id: null, avg: { $avg: '$pricePerUnit' } } }
            ]);
            return result.length > 0 ? Math.round(result[0].avg) : 0;
        } catch (err) {
            logger.error('[MarketplaceStatistics] getAveragePrice error:', err.message);
            return 0;
        }
    }

    /**
     * Gets total market volume (sum of all completed trade values).
     * @param {string} guildId
     * @returns {Promise<number>}
     */
    async getMarketVolume(guildId) {
        try {
            const result = await TradeHistory.aggregate([
                { $match: { guildId } },
                { $group: { _id: null, volume: { $sum: '$totalPrice' } } }
            ]);
            return result.length > 0 ? result[0].volume : 0;
        } catch (err) {
            logger.error('[MarketplaceStatistics] getMarketVolume error:', err.message);
            return 0;
        }
    }

    /**
     * Gets the count of currently active listings.
     * @param {string} guildId
     * @returns {Promise<number>}
     */
    async getActiveListingCount(guildId) {
        try {
            return MarketListing.countDocuments({ guildId, status: 'active' });
        } catch (err) {
            logger.error('[MarketplaceStatistics] getActiveListingCount error:', err.message);
            return 0;
        }
    }
}

module.exports = new MarketplaceStatistics();
