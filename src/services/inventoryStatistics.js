const InventoryItem = require('../models/InventoryItem');
const ItemUsageLog  = require('../models/ItemUsageLog');
const itemRegistry  = require('./itemRegistry');
const logger        = require('../utils/logger');

class InventoryStatistics {
    /**
     * Gets the most frequently used items in a guild.
     * @param {string} guildId
     * @param {number} limit
     * @returns {Promise<object[]>}
     */
    async getMostUsedItems(guildId, limit = 5) {
        try {
            const results = await ItemUsageLog.aggregate([
                { $match: { guildId, success: true } },
                { $group: { _id: '$itemId', useCount: { $sum: 1 } } },
                { $sort: { useCount: -1 } },
                { $limit: limit }
            ]);
            return results.map(r => ({
                itemId: r._id,
                useCount: r.useCount,
                item: itemRegistry.get(r._id)
            }));
        } catch (err) {
            logger.error('[InventoryStatistics] getMostUsedItems failed:', err.message);
            return [];
        }
    }

    /**
     * Gets the user with the largest inventory in a guild.
     * @param {string} guildId
     * @returns {Promise<object|null>}
     */
    async getLargestInventory(guildId) {
        try {
            const results = await InventoryItem.aggregate([
                { $match: { guildId } },
                { $group: { _id: '$userId', slotCount: { $sum: 1 }, totalItems: { $sum: '$quantity' } } },
                { $sort: { slotCount: -1 } },
                { $limit: 1 }
            ]);
            return results[0] || null;
        } catch (err) {
            logger.error('[InventoryStatistics] getLargestInventory failed:', err.message);
            return null;
        }
    }

    /**
     * Gets the rarest item currently held in any inventory in the guild.
     * @param {string} guildId
     * @returns {Promise<object|null>}
     */
    async getRarestItem(guildId) {
        try {
            const slots = await InventoryItem.find({ guildId }).distinct('itemId');
            let rarestItem = null;
            let highestRarity = -1;

            for (const itemId of slots) {
                const def = itemRegistry.get(itemId);
                if (!def) continue;
                const order = itemRegistry.getRarityOrder(def.rarity);
                if (order > highestRarity) {
                    highestRarity = order;
                    rarestItem = def;
                }
            }
            return rarestItem;
        } catch (err) {
            logger.error('[InventoryStatistics] getRarestItem failed:', err.message);
            return null;
        }
    }

    /**
     * Gets the distribution of items dropped per guild (loot stats).
     * @param {string} guildId
     * @param {number} limit
     * @returns {Promise<object[]>}
     */
    async getLootDistribution(guildId, limit = 10) {
        try {
            const results = await InventoryItem.aggregate([
                { $match: { guildId } },
                { $group: { _id: '$itemId', totalOwned: { $sum: '$quantity' }, holders: { $sum: 1 } } },
                { $sort: { totalOwned: -1 } },
                { $limit: limit }
            ]);
            return results.map(r => ({
                itemId: r._id,
                totalOwned: r.totalOwned,
                holders: r.holders,
                item: itemRegistry.get(r._id)
            }));
        } catch (err) {
            logger.error('[InventoryStatistics] getLootDistribution failed:', err.message);
            return [];
        }
    }
}

module.exports = new InventoryStatistics();
