const EscrowRecord  = require('../models/EscrowRecord');
const inventoryService = require('./inventoryService');
const logger        = require('../utils/logger');

class EscrowService {
    /**
     * Deposits an item into escrow by removing it from the seller's inventory.
     * Creates an EscrowRecord with status='held'.
     *
     * @param {string} guildId
     * @param {string} sellerId
     * @param {string} itemId
     * @param {number} qty
     * @param {string} listingId Reference to the parent listing
     * @returns {Promise<Document>} The EscrowRecord document
     */
    async deposit(guildId, sellerId, itemId, qty, listingId) {
        // Remove from seller's inventory (throws if insufficient)
        await inventoryService.remove(guildId, sellerId, itemId, qty);

        const escrowId = `escrow-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const record = await EscrowRecord.create({
            escrowId, listingId, guildId, sellerId, itemId, quantity: qty
        });

        logger.info(`[EscrowService] Deposited ${qty}x "${itemId}" from ${sellerId} → escrow ${escrowId}`);
        return record;
    }

    /**
     * Releases the escrowed item to the specified receiver (buyer or seller).
     * Adds item to receiver's inventory and marks escrow as released/returned.
     *
     * @param {string} escrowId
     * @param {string} receiverId  userId of the recipient
     * @param {'buyer'|'seller'} mode
     * @returns {Promise<Document>} Updated EscrowRecord
     */
    async release(escrowId, receiverId, mode = 'buyer') {
        const record = await EscrowRecord.findOne({ escrowId });
        if (!record) throw new Error(`Escrow "${escrowId}" tidak ditemukan.`);
        if (record.status !== 'held') {
            throw new Error(`Escrow "${escrowId}" sudah dilepas (status: ${record.status}).`);
        }

        // Add item to receiver's inventory
        await inventoryService.add(record.guildId, receiverId, record.itemId, record.quantity);

        // Update escrow record
        record.status     = mode === 'buyer' ? 'released' : 'returned';
        record.releasedTo = receiverId;
        record.releasedAt = new Date();
        await record.save();

        logger.info(`[EscrowService] Released escrow ${escrowId}: ${record.quantity}x "${record.itemId}" → ${receiverId} (${record.status})`);
        return record;
    }

    /**
     * Returns the escrow record by ID.
     * @param {string} escrowId
     * @returns {Promise<Document|null>}
     */
    async get(escrowId) {
        return EscrowRecord.findOne({ escrowId });
    }

    /**
     * Returns the escrow record by listing ID.
     * @param {string} listingId
     * @returns {Promise<Document|null>}
     */
    async getByListing(listingId) {
        return EscrowRecord.findOne({ listingId });
    }
}

module.exports = new EscrowService();
