const InventoryItem = require('../models/InventoryItem');
const itemRegistry = require('./itemRegistry');
const eventBus = require('./eventBus');
const logger = require('../utils/logger');

const SORT_MODES = ['name', 'rarity', 'quantity', 'category', 'acquiredAt'];

class InventoryEngine {
    constructor() {
        this.client = null;
        this.expiryTimer = null;
    }

    /**
     * Initializes the engine and starts the item expiry scanner.
     * @param {Client} client
     */
    init(client) {
        this.client = client;
        logger.info('[InventoryEngine] Initialized.');

        // Run expiry check every 5 minutes
        this.expiryTimer = setInterval(() => this._scanExpiredItems(), 5 * 60 * 1000);
    }

    /**
     * Sorts a user's inventory and returns sorted slot list.
     * Sort modes: name | rarity | quantity | category | acquiredAt
     * @param {string} guildId
     * @param {string} userId
     * @param {string} mode Sort mode
     * @returns {Promise<object[]>} Sorted array of {slot, item} pairs
     */
    async sort(guildId, userId, mode = 'rarity') {
        if (!SORT_MODES.includes(mode)) mode = 'rarity';

        const slots = await InventoryItem.find({ guildId, userId });
        const enriched = slots.map(slot => ({
            slot,
            item: itemRegistry.get(slot.itemId) || { name: slot.itemId, rarity: 'Common', category: 'Unknown' }
        }));

        enriched.sort((a, b) => {
            switch (mode) {
                case 'name':       return a.item.name.localeCompare(b.item.name);
                case 'quantity':   return b.slot.quantity - a.slot.quantity;
                case 'category':   return (a.item.category || '').localeCompare(b.item.category || '');
                case 'acquiredAt': return new Date(a.slot.acquiredAt) - new Date(b.slot.acquiredAt);
                case 'rarity':
                default:
                    return (itemRegistry.getRarityOrder(b.item.rarity) ?? 0) - (itemRegistry.getRarityOrder(a.item.rarity) ?? 0);
            }
        });

        return enriched;
    }

    /**
     * Searches a user's inventory by item name or category.
     * @param {string} guildId
     * @param {string} userId
     * @param {string} query Search term
     * @returns {Promise<object[]>} Matched {slot, item} pairs
     */
    async search(guildId, userId, query) {
        const q = (query || '').toLowerCase();
        const slots = await InventoryItem.find({ guildId, userId });

        return slots
            .map(slot => ({
                slot,
                item: itemRegistry.get(slot.itemId) || null
            }))
            .filter(({ item }) => {
                if (!item) return false;
                return item.name.toLowerCase().includes(q) ||
                       item.category.toLowerCase().includes(q) ||
                       item.description.toLowerCase().includes(q);
            });
    }

    /**
     * Filters a user's inventory by category and/or rarity.
     * @param {string} guildId
     * @param {string} userId
     * @param {object} filters { category?: string, rarity?: string }
     * @returns {Promise<object[]>} Filtered {slot, item} pairs
     */
    async filter(guildId, userId, { category, rarity } = {}) {
        const slots = await InventoryItem.find({ guildId, userId });

        return slots
            .map(slot => ({
                slot,
                item: itemRegistry.get(slot.itemId) || null
            }))
            .filter(({ item }) => {
                if (!item) return false;
                if (category && item.category !== category) return false;
                if (rarity   && item.rarity   !== rarity)   return false;
                return true;
            });
    }

    /**
     * Scans all inventory items and emits expiry events for expired ones.
     * MongoDB TTL index handles actual deletion, this handles events.
     * @private
     */
    async _scanExpiredItems() {
        try {
            const now = new Date();
            const expired = await InventoryItem.find({
                expiresAt: { $ne: null, $lte: now }
            });

            for (const slot of expired) {
                eventBus.emit('inventory.item_expired',
                    { userId: slot.userId, itemId: slot.itemId, quantity: slot.quantity },
                    { plugin: 'inventory', guildId: slot.guildId, userId: slot.userId }
                );
                logger.info(`[InventoryEngine] Expired item "${slot.itemId}" for user ${slot.userId}`);
            }
        } catch (err) {
            logger.error('[InventoryEngine] Error during expiry scan:', err.message);
        }
    }

    /**
     * Manually triggers an expiry check for a single user.
     */
    async expireItems(guildId, userId) {
        const now = new Date();
        const expired = await InventoryItem.find({ guildId, userId, expiresAt: { $ne: null, $lte: now } });
        for (const slot of expired) {
            eventBus.emit('inventory.item_expired',
                { userId, itemId: slot.itemId, quantity: slot.quantity },
                { plugin: 'inventory', guildId, userId }
            );
        }
    }
}

module.exports = new InventoryEngine();
