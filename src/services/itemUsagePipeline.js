const itemRegistry  = require('./itemRegistry');
const inventoryService = require('./inventoryService');
const itemEffectEngine = require('./itemEffectEngine');
const ItemUsageLog  = require('../models/ItemUsageLog');
const eventBus      = require('./eventBus');
const logger        = require('../utils/logger');

class ItemUsagePipeline {
    /**
     * Executes the 7-step item usage pipeline.
     *
     * Steps:
     *  1. Validate item exists in registry
     *  2. Validate item is marked `usable`
     *  3. Validate user has the item in inventory
     *  4. Process effects via ItemEffectEngine
     *  5. Consume 1x item from inventory
     *  6. Write ItemUsageLog entry
     *  7. Emit inventory.item_used EventBus event
     *
     * @param {string} guildId
     * @param {string} userId
     * @param {string} itemId
     * @param {object} [context] Extra context: { client, correlationId }
     * @returns {Promise<{success: boolean, item: object, applied: object[], failed: object[]}>}
     */
    async use(guildId, userId, itemId, context = {}) {
        const corrId = context.correlationId || `corr-use-${Date.now()}`;

        // ── Step 1: Registry validation ────────────────────────────────────────
        const def = itemRegistry.get(itemId);
        if (!def) {
            return this._fail(guildId, userId, itemId, `Item "${itemId}" tidak ditemukan.`, corrId);
        }

        // ── Step 2: Usability check ────────────────────────────────────────────
        if (!def.usable) {
            return this._fail(guildId, userId, itemId, `"${def.name}" tidak dapat digunakan.`, corrId);
        }

        // ── Step 3: Inventory check ────────────────────────────────────────────
        const hasItem = await inventoryService.has(guildId, userId, itemId, 1);
        if (!hasItem) {
            return this._fail(guildId, userId, itemId, `Kamu tidak memiliki "${def.name}" di inventory.`, corrId);
        }

        // ── Step 4: Apply effects ──────────────────────────────────────────────
        if (context.client) itemEffectEngine.setClient(context.client);
        const { applied, failed } = await itemEffectEngine.processEffects(guildId, userId, def, { correlationId: corrId });

        // ── Step 5: Consume item ───────────────────────────────────────────────
        await inventoryService.remove(guildId, userId, itemId, 1);

        // ── Step 6: Write usage log ────────────────────────────────────────────
        await ItemUsageLog.create({
            guildId, userId, itemId,
            effectsApplied: applied,
            success: true
        }).catch(err => logger.error('[ItemUsagePipeline] Failed to write usage log:', err.message));

        // ── Step 7: Emit event ─────────────────────────────────────────────────
        eventBus.emit('inventory.item_used',
            { userId, itemId, itemName: def.name, applied, failed },
            { plugin: 'inventory', guildId, userId, correlationId: corrId }
        );

        logger.info(`[ItemUsagePipeline] "${def.name}" used by ${userId}. Effects applied: ${applied.length}, failed: ${failed.length}`);

        return {
            success: true,
            item: def,
            applied,
            failed
        };
    }

    /**
     * Helper to build a standardized failure response and log to ItemUsageLog.
     * @private
     */
    async _fail(guildId, userId, itemId, reason, corrId) {
        await ItemUsageLog.create({
            guildId, userId, itemId,
            effectsApplied: [],
            success: false,
            failReason: reason
        }).catch(() => null);

        logger.warn(`[ItemUsagePipeline] Use failed for "${itemId}" by ${userId}: ${reason}`);
        return { success: false, reason, item: null, applied: [], failed: [] };
    }
}

module.exports = new ItemUsagePipeline();
