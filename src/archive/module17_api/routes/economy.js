/**
 * economy.js — Economy API routes for Module 17.
 * Base: /api/v1/economy
 */

const { Router }   = require('express');
const { success, error, paginated } = require('../formatters/apiResponse');
const { requirePermission } = require('../middleware/apiAuthorization');
const { strictLimiter }     = require('../middleware/apiRateLimiter');
const { validate }          = require('../middleware/apiValidator');

const router = Router();

// GET /:guildId/users/:userId/wallet
router.get('/:guildId/users/:userId/wallet',
    requirePermission('read:economy'),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;
            const Wallet = require('../../models/Wallet');
            const wallet = await Wallet.findOne({ guildId, userId });

            if (!wallet) {
                return res.json(success({
                    guildId, userId, coins: 0, premiumCoins: 0, experience: 0,
                    lifetimeEarnings: 0, lifetimeSpending: 0, netWorth: 0
                }, {}, req.correlationId));
            }

            return res.json(success({
                guildId, userId,
                coins:           wallet.coins,
                premiumCoins:    wallet.premiumCoins,
                experience:      wallet.experience,
                lifetimeEarnings: wallet.lifetimeEarnings,
                lifetimeSpending: wallet.lifetimeSpending
            }, {}, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// GET /:guildId/users/:userId/ledger
router.get('/:guildId/users/:userId/ledger',
    requirePermission('read:economy'),
    validate({ query: { page: 'integer|optional', limit: 'integer|optional' } }),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;
            const page  = Math.max(1, req.query.page  || 1);
            const limit = Math.min(50, req.query.limit || 10);
            const skip  = (page - 1) * limit;

            const LedgerEntry = require('../../models/LedgerEntry');
            const [entries, total] = await Promise.all([
                LedgerEntry.find({ guildId, userId }).sort({ timestamp: -1 }).skip(skip).limit(limit),
                LedgerEntry.countDocuments({ guildId, userId })
            ]);

            return res.json(paginated(entries, page, limit, total, req.correlationId));
        } catch (err) {
            return res.status(500).json(error('SERVER_ERROR', err.message, null, req.correlationId));
        }
    }
);

// POST /:guildId/users/:userId/deposit
router.post('/:guildId/users/:userId/deposit',
    requirePermission('write:economy'),
    strictLimiter,
    validate({ body: { amount: 'integer|required|min:1', currency: 'string|optional' } }),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;
            const { amount, currency = 'coins' } = req.body;

            const transactionPipeline = require('../../services/transactionPipeline');
            const wallet = await transactionPipeline.deposit(
                guildId, userId, amount, currency, 'api', 'API Deposit', req.correlationId
            );

            return res.json(success({ wallet: { coins: wallet.coins, premiumCoins: wallet.premiumCoins, experience: wallet.experience } }, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('DEPOSIT_FAILED', err.message, null, req.correlationId));
        }
    }
);

// POST /:guildId/users/:userId/withdraw
router.post('/:guildId/users/:userId/withdraw',
    requirePermission('write:economy'),
    strictLimiter,
    validate({ body: { amount: 'integer|required|min:1', currency: 'string|optional' } }),
    async (req, res) => {
        try {
            const { guildId, userId } = req.params;
            const { amount, currency = 'coins' } = req.body;

            const transactionPipeline = require('../../services/transactionPipeline');
            const wallet = await transactionPipeline.withdraw(
                guildId, userId, amount, currency, 'api', 'API Withdraw', req.correlationId
            );

            return res.json(success({ wallet: { coins: wallet.coins, premiumCoins: wallet.premiumCoins } }, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('WITHDRAW_FAILED', err.message, null, req.correlationId));
        }
    }
);

// POST /:guildId/transfer
router.post('/:guildId/transfer',
    requirePermission('write:economy'),
    strictLimiter,
    validate({ body: { fromUserId: 'string|required', toUserId: 'string|required', amount: 'integer|required|min:1', currency: 'string|optional' } }),
    async (req, res) => {
        try {
            const { guildId } = req.params;
            const { fromUserId, toUserId, amount, currency = 'coins' } = req.body;

            const transactionPipeline = require('../../services/transactionPipeline');
            const result = await transactionPipeline.transfer(
                guildId, fromUserId, toUserId, amount, currency, 'api', req.correlationId
            );

            return res.json(success(result, {}, req.correlationId));
        } catch (err) {
            return res.status(400).json(error('TRANSFER_FAILED', err.message, null, req.correlationId));
        }
    }
);

module.exports = router;
