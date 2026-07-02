const transactionPipeline = require('./transactionPipeline');
const eventBus = require('./eventBus');
const logger = require('../utils/logger');

class RewardDistributor {
    /**
     * Safely deposits coins as quest/achievement rewards.
     */
    async reward(guildId, userId, amount, currency = 'coins', sourcePlugin = 'core', correlationId = null, metadata = {}) {
        const corrId = correlationId || `corr-rew-${Date.now()}`;
        
        logger.info(`[RewardDistributor] Awarding ${amount} ${currency} to user ${userId} from "${sourcePlugin}"`);
        
        // Deposit using centralized TransactionPipeline
        const wallet = await transactionPipeline.deposit(
            guildId, 
            userId, 
            amount, 
            currency, 
            sourcePlugin, 
            'Reward', 
            corrId, 
            metadata
        );

        eventBus.emit('economy.reward', { userId, amount, currency }, { plugin: sourcePlugin, guildId, userId, correlationId: corrId });
        return wallet;
    }

    /**
     * Helper to process list of rewards (coins, xp, role) for quest/achievement completions.
     * @param {string} guildId 
     * @param {string} userId 
     * @param {object[]} rewards Array of reward definitions
     * @param {string} sourcePlugin Source identifier
     */
    async distributeList(guildId, userId, rewards, sourcePlugin) {
        for (const r of rewards) {
            try {
                if (r.type === 'coins') {
                    await this.reward(guildId, userId, r.amount, 'coins', sourcePlugin);
                } else if (r.type === 'xp') {
                    // Emit level xp gains for ProgressionEngine to absorb
                    eventBus.emit('economy.xp_earned', { userId, xp: r.amount }, { plugin: sourcePlugin, guildId, userId });
                }
            } catch (err) {
                logger.error(`[RewardDistributor] Failed to award ${r.type} reward:`, err.message);
            }
        }
    }
}

module.exports = new RewardDistributor();
