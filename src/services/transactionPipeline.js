const Wallet = require('../models/Wallet');
const ledgerService = require('./ledgerService');
const eventBus = require('./eventBus');
const logger = require('../utils/logger');

class TransactionPipeline {
    /**
     * Increments user wallet balances safely and registers ledger audits.
     * @returns {Promise<Document>} Updated Wallet document
     */
    async deposit(guildId, userId, amount, currency = 'coins', sourcePlugin = 'core', action = 'Reward', correlationId = null, metadata = {}) {
        if (amount <= 0) throw new Error('Nilai deposit harus lebih besar dari nol.');
        const corrId = correlationId || `corr-dep-${Date.now()}`;

        // Find or create wallet
        let wallet = await Wallet.findOne({ guildId, userId });
        if (!wallet) {
            wallet = new Wallet({ guildId, userId, coins: 0, premiumCoins: 0, experience: 0 });
        }

        const balanceBefore = wallet[currency] || 0;
        wallet[currency] = balanceBefore + amount;
        wallet.lifetimeEarnings += amount;

        await wallet.save();

        // Record in ledger
        await ledgerService.record({
            correlationId: corrId,
            guildId,
            userId,
            sourcePlugin,
            action,
            currency,
            amount,
            balanceBefore,
            balanceAfter: wallet[currency],
            metadata
        });

        // Emit EventBus events
        eventBus.emit('economy.deposit', { userId, currency, amount }, { plugin: sourcePlugin, guildId, userId, correlationId: corrId });
        eventBus.emit('economy.transaction.completed', { userId, action, amount }, { plugin: sourcePlugin, guildId, userId, correlationId: corrId });

        return wallet;
    }

    /**
     * Decrements user wallet balances safely and registers ledger audits.
     * @returns {Promise<Document>} Updated Wallet document
     */
    async withdraw(guildId, userId, amount, currency = 'coins', sourcePlugin = 'core', action = 'Purchase', correlationId = null, metadata = {}) {
        if (amount <= 0) throw new Error('Nilai penarikan harus lebih besar dari nol.');
        const corrId = correlationId || `corr-wth-${Date.now()}`;

        let wallet = await Wallet.findOne({ guildId, userId });
        if (!wallet || (wallet[currency] || 0) < amount) {
            throw new Error(`Transaksi ditolak: Saldo ${currency} tidak mencukupi.`);
        }

        const balanceBefore = wallet[currency];
        wallet[currency] = balanceBefore - amount;
        wallet.lifetimeSpending += amount;

        await wallet.save();

        // Record in ledger
        await ledgerService.record({
            correlationId: corrId,
            guildId,
            userId,
            sourcePlugin,
            action,
            currency,
            amount: -amount,
            balanceBefore,
            balanceAfter: wallet[currency],
            metadata
        });

        // Emit EventBus events
        eventBus.emit('economy.withdraw', { userId, currency, amount }, { plugin: sourcePlugin, guildId, userId, correlationId: corrId });
        eventBus.emit('economy.transaction.completed', { userId, action, amount: -amount }, { plugin: sourcePlugin, guildId, userId, correlationId: corrId });

        return wallet;
    }

    /**
     * Executes safe transfers from sender to receiver applying 5% tax.
     */
    async transfer(guildId, fromUserId, toUserId, amount, currency = 'coins', sourcePlugin = 'core', correlationId = null, metadata = {}) {
        if (fromUserId === toUserId) throw new Error('Anda tidak dapat mentransfer saldo ke diri sendiri.');
        if (amount <= 0) throw new Error('Nilai transfer harus lebih besar dari nol.');
        
        const corrId = correlationId || `corr-trsf-${Date.now()}`;
        logger.info(`[TransactionPipeline] Initiating transfer: ${fromUserId} -> ${toUserId} of ${amount} ${currency}`);

        // Withdraw full amount from sender
        await this.withdraw(guildId, fromUserId, amount, currency, sourcePlugin, 'Transfer', corrId, { ...metadata, recipientId: toUserId });

        // Calculate tax fee (5%)
        const taxRate = 0.05;
        const taxAmount = Math.round(amount * taxRate);
        const netAmount = amount - taxAmount;

        try {
            // Deposit net amount to recipient
            await this.deposit(guildId, toUserId, netAmount, currency, sourcePlugin, 'Transfer', corrId, { ...metadata, senderId: fromUserId });

            // Deposit tax into server sink if tax > 0
            if (taxAmount > 0) {
                // Record tax sink (we log it as 'Tax' in ledger for the sender's reference)
                await ledgerService.record({
                    correlationId: corrId,
                    guildId,
                    userId: fromUserId,
                    sourcePlugin,
                    action: 'Tax',
                    currency,
                    amount: -taxAmount,
                    balanceBefore: netAmount + taxAmount, // virtual before state mapping
                    balanceAfter: netAmount,
                    metadata: { type: 'Transfer Fee', netAmount, taxAmount }
                });
                eventBus.emit('economy.tax', { guildId, taxAmount }, { plugin: sourcePlugin, guildId, userId: fromUserId, correlationId: corrId });
            }

            eventBus.emit('economy.transfer', { fromUserId, toUserId, amount, netAmount, taxAmount }, { plugin: sourcePlugin, guildId, userId: fromUserId, correlationId: corrId });
            
            return {
                success: true,
                taxAmount,
                netAmount
            };
        } catch (err) {
            // Rollback withdrawal to sender if transfer fails
            logger.warn(`[TransactionPipeline] Transfer failed. Rolling back ${amount} to sender ${fromUserId}`);
            await this.deposit(guildId, fromUserId, amount, currency, sourcePlugin, 'Refund', corrId, { ...metadata, error: err.message, note: 'Transfer rollback refund' });
            throw err;
        }
    }
}

module.exports = new TransactionPipeline();
