const InventoryItem = require('../models/InventoryItem');
const itemRegistry = require('./itemRegistry');
const eventBus = require('./eventBus');
const logger = require('../utils/logger');

// Default max inventory slots per user
const DEFAULT_CAPACITY = 100;

class InventoryService {
    /**
     * Adds an item to a user's inventory. Handles stacking automatically.
     * @param {string} guildId
     * @param {string} userId
     * @param {string} itemId
     * @param {number} qty Amount to add
     * @param {object} meta Additional metadata to store
     * @param {Date|null} expiresAt Optional expiry date
     * @returns {Promise<Document>} Updated or created InventoryItem document
     */
    async add(guildId, userId, itemId, qty = 1, meta = {}, expiresAt = null) {
        if (qty <= 0) throw new Error('Jumlah item harus lebih dari nol.');

        const def = itemRegistry.get(itemId);
        if (!def) throw new Error(`Item "${itemId}" tidak ditemukan di registry.`);

        let slot = await InventoryItem.findOne({ guildId, userId, itemId });

        if (slot) {
            // Validate stack limit
            if (def.stackable) {
                const newQty = slot.quantity + qty;
                if (newQty > (def.maxStack ?? 99)) {
                    throw new Error(`Stack maksimum untuk "${def.name}" adalah ${def.maxStack}.`);
                }
                slot.quantity = newQty;
            } else {
                throw new Error(`"${def.name}" tidak dapat di-stack.`);
            }
            await slot.save();
        } else {
            // Check capacity
            const slotCount = await InventoryItem.countDocuments({ guildId, userId });
            if (slotCount >= DEFAULT_CAPACITY) {
                throw new Error(`Inventory penuh (maksimum ${DEFAULT_CAPACITY} slot).`);
            }

            slot = await InventoryItem.create({
                guildId, userId, itemId,
                quantity: qty,
                metadata: meta,
                expiresAt
            });
        }

        eventBus.emit('inventory.item_added', { userId, itemId, qty }, { plugin: 'inventory', guildId, userId });
        logger.info(`[InventoryService] +${qty}x "${itemId}" → user ${userId}`);
        return slot;
    }

    /**
     * Removes a quantity of an item from user's inventory.
     * @param {string} guildId
     * @param {string} userId
     * @param {string} itemId
     * @param {number} qty Amount to remove
     * @returns {Promise<void>}
     */
    async remove(guildId, userId, itemId, qty = 1) {
        if (qty <= 0) throw new Error('Jumlah harus lebih dari nol.');

        const slot = await InventoryItem.findOne({ guildId, userId, itemId });
        if (!slot || slot.quantity < qty) {
            throw new Error(`Jumlah "${itemId}" tidak mencukupi di inventory.`);
        }

        slot.quantity -= qty;

        if (slot.quantity <= 0) {
            await InventoryItem.deleteOne({ _id: slot._id });
        } else {
            await slot.save();
        }

        eventBus.emit('inventory.item_removed', { userId, itemId, qty }, { plugin: 'inventory', guildId, userId });
        logger.info(`[InventoryService] -${qty}x "${itemId}" ← user ${userId}`);
    }

    /**
     * Checks if a user has at least `qty` of an item.
     * @returns {Promise<boolean>}
     */
    async has(guildId, userId, itemId, qty = 1) {
        const slot = await InventoryItem.findOne({ guildId, userId, itemId });
        return !!(slot && slot.quantity >= qty);
    }

    /**
     * Gets a single inventory slot for a user.
     * @returns {Promise<Document|null>}
     */
    async get(guildId, userId, itemId) {
        return InventoryItem.findOne({ guildId, userId, itemId });
    }

    /**
     * Gets the full inventory for a user, sorted by acquiredAt desc.
     * @returns {Promise<Document[]>}
     */
    async getAll(guildId, userId) {
        return InventoryItem.find({ guildId, userId }).sort({ acquiredAt: -1 });
    }

    /**
     * Removes all inventory items for a user (admin utility).
     * @returns {Promise<void>}
     */
    async clear(guildId, userId) {
        await InventoryItem.deleteMany({ guildId, userId });
        logger.warn(`[InventoryService] Cleared entire inventory for user ${userId}`);
    }

    /**
     * Gets the current slot count used by a user.
     * @returns {Promise<number>}
     */
    async getSlotCount(guildId, userId) {
        return InventoryItem.countDocuments({ guildId, userId });
    }
}

module.exports = new InventoryService();
