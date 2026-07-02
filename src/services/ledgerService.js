const LedgerEntry = require('../models/LedgerEntry');
const logger = require('../utils/logger');

class LedgerService {
    /**
     * Writes a double-entry transaction record into the DB ledger.
     * @param {object} params Core ledger entry keys
     * @returns {Promise<Document>} The saved LedgerEntry document
     */
    async record(params) {
        const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        try {
            const entry = await LedgerEntry.create({
                transactionId,
                correlationId: params.correlationId || `corr-tx-${Date.now()}`,
                guildId: params.guildId,
                userId: params.userId,
                sourcePlugin: params.sourcePlugin,
                action: params.action,
                currency: params.currency || 'coins',
                amount: params.amount,
                balanceBefore: params.balanceBefore,
                balanceAfter: params.balanceAfter,
                metadata: params.metadata || {}
            });

            logger.info(`[Ledger] Recorded Tx ${transactionId} [${params.action}] for user ${params.userId}: ${params.amount >= 0 ? '+' : ''}${params.amount} ${params.currency}`);
            return entry;
        } catch (err) {
            logger.error('[LedgerService] Failed to write ledger entry:', err.message);
            throw err;
        }
    }

    /**
     * Retrieves transactions matching search filters.
     */
    async getTransactions(query = {}, limit = 10) {
        return LedgerEntry.find(query).sort({ timestamp: -1 }).limit(limit);
    }
}

module.exports = new LedgerService();
