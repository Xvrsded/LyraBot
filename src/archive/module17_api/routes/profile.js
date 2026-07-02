/**
 * profile.js — Aggregated player profile API route for Module 17.
 * Base: /api/v1/profile
 *
 * Returns a single aggregated object combining:
 *  - Wallet (economy)
 *  - Inventory count + top items
 *  - Active quest count
 *  - Achievement count
 *  - Recent trade history
 */

const { Router }   = require('express');
const { success, error } = require('../formatters/apiResponse');
const { requirePermission } = require('../middleware/apiAuthorization');

const router = Router();

// GET /:guildId/users/:userId/profile
router.get('/:guildId/users/:userId/profile',
    requirePermission('read:profile'),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;

            // Run all data fetches in parallel
            const [wallet, inventoryItems, questCount, tradeHistory] = await Promise.allSettled([
                // Wallet
                (async () => {
                    const Wallet = require('../../models/Wallet');
                    return Wallet.findOne({ guildId, userId });
                })(),

                // Inventory top 5 items
                (async () => {
                    const InventoryItem = require('../../models/InventoryItem');
                    return InventoryItem.find({ guildId, userId }).limit(5).sort({ acquiredAt: -1 });
                })(),

                // Active quest count
                (async () => {
                    try {
                        const QuestProgress = require('../../models/QuestProgress');
                        return QuestProgress.countDocuments({ guildId, userId, status: 'active' });
                    } catch (_) { return 0; }
                })(),

                // Recent trade history
                (async () => {
                    const TradeHistory = require('../../models/TradeHistory');
                    return TradeHistory.find({ guildId, $or: [{ sellerId: userId }, { buyerId: userId }] })
                        .sort({ completedAt: -1 }).limit(5);
                })()
            ]);

            const walletData = wallet.status === 'fulfilled' ? wallet.value : null;
            const invData    = inventoryItems.status === 'fulfilled' ? inventoryItems.value : [];
            const questTotal = questCount.status === 'fulfilled' ? questCount.value : 0;
            const trades     = tradeHistory.status === 'fulfilled' ? tradeHistory.value : [];

            const itemRegistry = require('../../services/itemRegistry');

            const profile = {
                userId,
                guildId,
                economy: walletData ? {
                    coins:           walletData.coins,
                    premiumCoins:    walletData.premiumCoins,
                    experience:      walletData.experience,
                    lifetimeEarnings: walletData.lifetimeEarnings,
                    lifetimeSpending: walletData.lifetimeSpending
                } : null,
                inventory: {
                    recentItems: invData.map(slot => ({
                        itemId:   slot.itemId,
                        quantity: slot.quantity,
                        name:     itemRegistry.get(slot.itemId)?.name || slot.itemId
                    }))
                },
                quests: { activeCount: questTotal },
                recentTrades: trades.map(t => ({
                    tradeId:    t.tradeId,
                    itemId:     t.itemId,
                    itemName:   itemRegistry.get(t.itemId)?.name || t.itemId,
                    totalPrice: t.totalPrice,
                    role:       t.sellerId === userId ? 'seller' : 'buyer',
                    completedAt: t.completedAt
                }))
            };

            return res.json(success(profile, {}, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

module.exports = router;
