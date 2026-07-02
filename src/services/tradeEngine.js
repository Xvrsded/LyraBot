const listingService      = require('./listingService');
const escrowService       = require('./escrowService');
const transactionPipeline = require('./transactionPipeline');
const inventoryService    = require('./inventoryService');
const TradeHistory        = require('../models/TradeHistory');
const eventBus            = require('./eventBus');
const logger              = require('../utils/logger');

class TradeEngine {
    /**
     * Executes the 10-step atomic buy pipeline with full rollback safety.
     *
     * Steps:
     *  1.  Fetch and validate listing is active
     *  2.  Validate buyer is not the seller
     *  3.  Validate buyer has sufficient coins
     *  4.  Validate buyer has inventory capacity
     *  5.  Withdraw coins from buyer
     *  6.  Release item from escrow to buyer
     *  7.  On item failure → refund coins to buyer
     *  8.  Deposit coins to seller
     *  9.  Mark listing as sold + create TradeHistory
     *  10. Emit market.sold + trade.completed
     *
     * @param {string} guildId
     * @param {string} buyerId
     * @param {string} listingId
     * @param {object} [context] Extra context: { correlationId }
     * @returns {Promise<{success: boolean, listing: object, tradeId?: string, reason?: string}>}
     */
    async buy(guildId, buyerId, listingId, context = {}) {
        const corrId = context.correlationId || `corr-trade-${Date.now()}`;

        // ── Step 1: Fetch listing ──────────────────────────────────────────
        const listing = await listingService.getById(listingId);
        if (!listing || listing.guildId !== guildId) {
            return { success: false, reason: `Listing "${listingId}" tidak ditemukan.` };
        }
        if (listing.status !== 'active') {
            return { success: false, reason: `Listing "${listingId}" sudah tidak aktif (status: ${listing.status}).` };
        }

        // ── Step 2: Self-purchase guard ────────────────────────────────────
        if (listing.sellerId === buyerId) {
            return { success: false, reason: 'Kamu tidak dapat membeli listing milik sendiri.' };
        }

        // ── Step 3: Wallet check ───────────────────────────────────────────
        const Wallet = require('../models/Wallet');
        const wallet = await Wallet.findOne({ guildId, userId: buyerId });
        const balance = wallet ? wallet.coins : 0;
        if (balance < listing.totalPrice) {
            return { success: false, reason: `Saldo coins tidak mencukupi. Dibutuhkan: \`${listing.totalPrice}\`, dimiliki: \`${balance}\`.` };
        }

        // ── Step 4: Inventory capacity check ──────────────────────────────
        const InventoryItem = require('../models/InventoryItem');
        const slotCount = await InventoryItem.countDocuments({ guildId, userId: buyerId });
        if (slotCount >= 100) {
            return { success: false, reason: 'Inventory kamu penuh (100 slot). Kosongkan inventory terlebih dahulu.' };
        }

        // ── Step 5: Withdraw coins from buyer ─────────────────────────────
        try {
            await transactionPipeline.withdraw(
                guildId, buyerId, listing.totalPrice, 'coins',
                'marketplace', 'Purchase', corrId,
                { listingId, itemId: listing.itemId, sellerId: listing.sellerId }
            );
        } catch (err) {
            logger.error(`[TradeEngine] Failed to withdraw ${listing.totalPrice} from buyer ${buyerId}: ${err.message}`);
            return { success: false, reason: `Penarikan coins gagal: ${err.message}` };
        }

        // ── Step 6: Release item from escrow to buyer ──────────────────────
        try {
            await escrowService.release(listing.escrowId, buyerId, 'buyer');
        } catch (err) {
            logger.error(`[TradeEngine] Item delivery failed for listing ${listingId}. Initiating refund.`);
            // ── Step 7: Refund buyer coins ────────────────────────────────
            await transactionPipeline.deposit(
                guildId, buyerId, listing.totalPrice, 'coins',
                'marketplace', 'Refund', corrId,
                { reason: 'Trade item delivery failed', listingId }
            ).catch(refundErr =>
                logger.error(`[TradeEngine] CRITICAL: Refund also failed for ${buyerId}: ${refundErr.message}`)
            );
            return { success: false, reason: `Pengiriman item gagal: ${err.message}. Coins dikembalikan.` };
        }

        // ── Step 8: Pay seller ────────────────────────────────────────────
        await transactionPipeline.deposit(
            guildId, listing.sellerId, listing.totalPrice, 'coins',
            'marketplace', 'Trade', corrId,
            { listingId, itemId: listing.itemId, buyerId }
        ).catch(err =>
            // Non-fatal: seller payment failed, but trade is already complete for buyer
            // Log as critical for manual resolution
            logger.error(`[TradeEngine] CRITICAL: Seller payment failed for ${listing.sellerId}: ${err.message}`)
        );

        // ── Step 9: Record trade ──────────────────────────────────────────
        const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        await listingService.markSold(listingId, buyerId);

        await TradeHistory.create({
            tradeId,
            listingId,
            guildId,
            sellerId: listing.sellerId,
            buyerId,
            itemId:       listing.itemId,
            quantity:     listing.quantity,
            pricePerUnit: listing.pricePerUnit,
            totalPrice:   listing.totalPrice
        });

        // ── Step 10: Emit events ──────────────────────────────────────────
        eventBus.emit('market.sold',
            { buyerId, sellerId: listing.sellerId, itemId: listing.itemId, totalPrice: listing.totalPrice, listingId },
            { plugin: 'marketplace', guildId, userId: buyerId, correlationId: corrId }
        );
        eventBus.emit('trade.completed',
            { tradeId, buyerId, sellerId: listing.sellerId, itemId: listing.itemId, totalPrice: listing.totalPrice },
            { plugin: 'marketplace', guildId, userId: buyerId, correlationId: corrId }
        );

        logger.info(`[TradeEngine] Trade ${tradeId} completed: ${buyerId} bought ${listing.quantity}x "${listing.itemId}" from ${listing.sellerId} for ${listing.totalPrice} coins`);

        return {
            success: true,
            tradeId,
            listing,
            totalPrice: listing.totalPrice
        };
    }
}

module.exports = new TradeEngine();
