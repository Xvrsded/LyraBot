const rewardDistributor = require('./rewardDistributor');
const eventBus = require('./eventBus');
const logger = require('../utils/logger');

class ItemEffectEngine {
    constructor() {
        this.client = null;
    }

    setClient(client) {
        this.client = client;
    }

    /**
     * Processes all effects from an item definition for a given user.
     * @param {string} guildId
     * @param {string} userId
     * @param {object} itemDef The full item definition object from ItemRegistry
     * @param {object} context Additional context (correlationId, etc.)
     * @returns {Promise<{applied: object[], failed: object[]}>}
     */
    async processEffects(guildId, userId, itemDef, context = {}) {
        const applied = [];
        const failed  = [];

        for (const effect of (itemDef.effects || [])) {
            try {
                await this._applyEffect(guildId, userId, effect, itemDef, context);
                applied.push(effect);
            } catch (err) {
                logger.error(`[ItemEffectEngine] Effect "${effect.type}" failed for "${itemDef.id}": ${err.message}`);
                failed.push({ ...effect, error: err.message });
            }
        }

        return { applied, failed };
    }

    /**
     * Applies a single effect object.
     * @private
     */
    async _applyEffect(guildId, userId, effect, itemDef, context) {
        const corrId = context.correlationId || `corr-item-${Date.now()}`;

        switch (effect.type) {
            // ── Coins / PremiumCoins reward ────────────────────────────────
            case 'coins': {
                const currency = effect.currency || 'coins';
                const amount   = Number(effect.amount) || 0;
                if (amount <= 0) throw new Error('Effect amount must be positive.');

                await rewardDistributor.reward(guildId, userId, amount, currency, `item:${itemDef.id}`, corrId, {
                    itemId: itemDef.id,
                    itemName: itemDef.name
                });

                logger.info(`[ItemEffectEngine] +${amount} ${currency} → ${userId} (item: ${itemDef.id})`);
                break;
            }

            // ── XP reward (emitted to ProgressionEngine via EventBus) ──────
            case 'xp': {
                const xp = Number(effect.amount) || 0;
                if (xp <= 0) throw new Error('XP amount must be positive.');

                eventBus.emit('economy.xp_earned',
                    { userId, xp },
                    { plugin: `item:${itemDef.id}`, guildId, userId, correlationId: corrId }
                );
                logger.info(`[ItemEffectEngine] +${xp} XP → ${userId} (item: ${itemDef.id})`);
                break;
            }

            // ── Discord Role grant ─────────────────────────────────────────
            case 'role': {
                if (!this.client) throw new Error('Client not available for role effect.');
                const guild  = this.client.guilds.cache.get(guildId);
                const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
                const role   = guild ? guild.roles.cache.get(effect.roleId) : null;

                if (!member) throw new Error(`Member ${userId} not found.`);
                if (!role)   throw new Error(`Role ${effect.roleId} not found.`);

                await member.roles.add(role, `Item Effect: Used "${itemDef.name}"`);
                logger.info(`[ItemEffectEngine] Role "${role.name}" → ${userId} (item: ${itemDef.id})`);
                break;
            }

            // ── Loot Table roll (mystery boxes) ───────────────────────────
            case 'loot_table': {
                const lootEngine = require('./lootEngine');
                await lootEngine.rollTable(effect.tableId, guildId, userId);
                logger.info(`[ItemEffectEngine] Rolled loot table "${effect.tableId}" for ${userId}`);
                break;
            }

            // ── Custom event (plugin-defined effects) ─────────────────────
            case 'custom': {
                const eventName = effect.event || 'item.custom_effect';
                eventBus.emit(eventName,
                    { userId, itemId: itemDef.id, payload: effect.payload || {} },
                    { plugin: `item:${itemDef.id}`, guildId, userId, correlationId: corrId }
                );
                logger.info(`[ItemEffectEngine] Custom event "${eventName}" emitted for ${userId}`);
                break;
            }

            default:
                logger.warn(`[ItemEffectEngine] Unknown effect type "${effect.type}" in item "${itemDef.id}". Skipping.`);
        }
    }
}

module.exports = new ItemEffectEngine();
