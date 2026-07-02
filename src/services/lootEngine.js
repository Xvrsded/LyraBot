const dropTableManager = require('./dropTableManager');
const inventoryService = require('./inventoryService');
const itemRegistry     = require('./itemRegistry');
const eventBus         = require('./eventBus');
const logger           = require('../utils/logger');

class LootEngine {
    constructor() {
        this.client = null;
    }

    /**
     * Initializes the loot engine: loads drop tables and registers EventBus triggers.
     * @param {Client} client
     */
    init(client) {
        this.client = client;

        itemRegistry.loadAll();
        dropTableManager.loadAll();
        dropTableManager.registerListeners(this.rollTable.bind(this));

        logger.info('[LootEngine] Initialized — drop table listeners active.');
    }

    /**
     * Executes a full weighted random roll on a given drop table.
     * Awards resulting items directly to the user's inventory.
     *
     * @param {string} tableId Drop table ID
     * @param {string} guildId
     * @param {string} userId
     * @param {number} [rolls] Override number of rolls (default: table.rollsPerTrigger)
     * @returns {Promise<object[]>} Array of dropped { itemId, qty } objects
     */
    async rollTable(tableId, guildId, userId, rolls) {
        const table = dropTableManager.get(tableId);
        if (!table) {
            logger.warn(`[LootEngine] Drop table "${tableId}" not found.`);
            return [];
        }

        const rollCount = rolls ?? table.rollsPerTrigger ?? 1;
        const drops = [];

        for (let i = 0; i < rollCount; i++) {
            // ── Weighted random slot selection ─────────────────────────────
            const slot = this._weightedRandom(table.slots);
            if (slot) {
                const qty = this._randomInt(slot.minQty ?? 1, slot.maxQty ?? 1);
                drops.push({ itemId: slot.itemId, qty });
            }
        }

        // ── Guaranteed drops ───────────────────────────────────────────────
        for (const g of (table.guaranteed || [])) {
            drops.push({ itemId: g.itemId, qty: g.qty ?? 1 });
        }

        // ── Bonus roll ─────────────────────────────────────────────────────
        if (table.bonus && Math.random() < (table.bonus.chance ?? 0)) {
            drops.push({ itemId: table.bonus.itemId, qty: table.bonus.qty ?? 1 });
        }

        // ── Award all drops to inventory ───────────────────────────────────
        const awarded = [];
        for (const drop of drops) {
            try {
                await inventoryService.add(guildId, userId, drop.itemId, drop.qty);
                awarded.push(drop);
                logger.info(`[LootEngine] Awarded ${drop.qty}x "${drop.itemId}" → ${userId} from table "${tableId}"`);
            } catch (err) {
                logger.warn(`[LootEngine] Could not add "${drop.itemId}" to ${userId}: ${err.message}`);
            }
        }

        if (awarded.length > 0) {
            eventBus.emit('loot.generated',
                { userId, tableId, drops: awarded },
                { plugin: 'loot-engine', guildId, userId }
            );
        }

        return awarded;
    }

    /**
     * Performs a weighted random selection from an array of slots.
     * Each slot must have a `weight` property.
     * @param {object[]} slots
     * @returns {object|null} Selected slot
     */
    _weightedRandom(slots) {
        if (!slots || slots.length === 0) return null;

        const totalWeight = slots.reduce((sum, s) => sum + (s.weight || 0), 0);
        if (totalWeight <= 0) return null;

        let rand = Math.random() * totalWeight;
        for (const slot of slots) {
            rand -= (slot.weight || 0);
            if (rand <= 0) return slot;
        }
        return slots[slots.length - 1];
    }

    /**
     * Returns a random integer between min and max inclusive.
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    _randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

module.exports = new LootEngine();
