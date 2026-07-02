const itemRegistry    = require('./itemRegistry');
const inventoryService = require('./inventoryService');
const escrowService   = require('./escrowService');
const listingService  = require('./listingService');
const tradeEngine     = require('./tradeEngine');
const logger          = require('../utils/logger');

class MarketplaceEngine {
    constructor() {
        this.client     = null;
        this.expiryTimer = null;
    }

    /**
     * Initializes the marketplace engine and starts the listing expiry scanner.
     * @param {Client} client
     */
    init(client) {
        this.client = client;
        // Run expiry check every 10 minutes
        this.expiryTimer = setInterval(() => this._runExpiryScanner(), 10 * 60 * 1000);
        logger.info('[MarketplaceEngine] Initialized — expiry scanner active.');
    }

    /**
     * Creates a marketplace listing after escrow validation.
     * Full validation pipeline:
     *  1. Item exists in registry
     *  2. Item is tradable
     *  3. Seller owns the item
     *  4. Price is valid (≥ 1)
     *  5. Deposit to escrow (removes from inventory)
     *  6. Create listing record
     *
     * @param {string} guildId
     * @param {string} sellerId
     * @param {string} itemId
     * @param {number} qty
     * @param {number} pricePerUnit  Coins per unit
     * @param {object} options  { expiresAt?: Date, featured?: boolean }
     * @returns {Promise<{success: boolean, listing?: object, reason?: string}>}
     */
    async sell(guildId, sellerId, itemId, qty, pricePerUnit, options = {}) {
        // ── Validation ─────────────────────────────────────────────────────
        const def = itemRegistry.get(itemId);
        if (!def) {
            return { success: false, reason: `Item "${itemId}" tidak ditemukan di registry.` };
        }
        if (!def.tradable) {
            return { success: false, reason: `"${def.name}" tidak dapat diperjualbelikan.` };
        }
        if (qty < 1) {
            return { success: false, reason: 'Jumlah harus minimal 1.' };
        }
        if (pricePerUnit < 1) {
            return { success: false, reason: 'Harga per unit harus minimal 1 coin.' };
        }

        const hasItem = await inventoryService.has(guildId, sellerId, itemId, qty);
        if (!hasItem) {
            return { success: false, reason: `Kamu tidak memiliki \`${qty}x\` "${def.name}" di inventory.` };
        }

        // ── Escrow deposit ─────────────────────────────────────────────────
        // Generate a placeholder listingId for escrow creation
        const tempListingId = `lst-pending-${Date.now()}`;
        let escrowRecord;
        try {
            escrowRecord = await escrowService.deposit(guildId, sellerId, itemId, qty, tempListingId);
        } catch (err) {
            return { success: false, reason: `Escrow deposit gagal: ${err.message}` };
        }

        // ── Create listing ─────────────────────────────────────────────────
        try {
            const listing = await listingService.create(
                guildId, sellerId, itemId, qty, pricePerUnit,
                escrowRecord.escrowId, options.expiresAt || null
            );

            // Update escrow record with real listingId
            escrowRecord.listingId = listing.listingId;
            await escrowRecord.save();

            logger.info(`[MarketplaceEngine] Sell: ${sellerId} listed ${qty}x "${itemId}" @ ${pricePerUnit} coins → ${listing.listingId}`);
            return { success: true, listing };
        } catch (err) {
            // Rollback escrow if listing creation fails
            logger.error(`[MarketplaceEngine] Listing creation failed. Rolling back escrow.`);
            await escrowService.release(escrowRecord.escrowId, sellerId, 'seller').catch(() => null);
            return { success: false, reason: `Pembuatan listing gagal: ${err.message}` };
        }
    }

    /**
     * Delegates the buy pipeline to TradeEngine.
     */
    async buy(guildId, buyerId, listingId, context = {}) {
        return tradeEngine.buy(guildId, buyerId, listingId, context);
    }

    /**
     * Cancels an active listing and returns the item from escrow to the seller.
     *
     * @param {string} guildId
     * @param {string} sellerId  Must be the owner of the listing
     * @param {string} listingId
     * @returns {Promise<{success: boolean, reason?: string}>}
     */
    async cancel(guildId, sellerId, listingId) {
        const listing = await listingService.getById(listingId);
        if (!listing || listing.guildId !== guildId) {
            return { success: false, reason: `Listing "${listingId}" tidak ditemukan.` };
        }
        if (listing.sellerId !== sellerId) {
            return { success: false, reason: 'Kamu bukan pemilik listing ini.' };
        }
        if (listing.status !== 'active') {
            return { success: false, reason: `Listing ini sudah tidak aktif (status: ${listing.status}).` };
        }

        // Return item from escrow
        await escrowService.release(listing.escrowId, sellerId, 'seller');
        // Mark listing cancelled
        await listingService.cancel(listingId);

        logger.info(`[MarketplaceEngine] Cancelled listing ${listingId} by ${sellerId}`);
        return { success: true };
    }

    /**
     * Runs periodically to expire overdue listings and return items to sellers.
     * @private
     */
    async _runExpiryScanner() {
        try {
            // Gather all guild IDs with active listings
            const MarketListing = require('../models/MarketListing');
            const guilds = await MarketListing.distinct('guildId', { status: 'active' });

            for (const guildId of guilds) {
                const expired = await listingService.expireOld(guildId);
                for (const listing of expired) {
                    // Return item to seller via escrow
                    await escrowService.release(listing.escrowId, listing.sellerId, 'seller')
                        .catch(err => logger.warn(`[MarketplaceEngine] Expiry escrow release failed for ${listing.listingId}: ${err.message}`));
                }
            }
        } catch (err) {
            logger.error('[MarketplaceEngine] Expiry scanner error:', err.message);
        }
    }
}

module.exports = new MarketplaceEngine();
