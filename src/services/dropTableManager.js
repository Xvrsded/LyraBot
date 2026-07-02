const fs = require('fs');
const path = require('path');
const eventBus = require('./eventBus');
const logger = require('../utils/logger');

class DropTableManager {
    constructor() {
        /** @type {Map<string, object>} tableId → DropTableDefinition */
        this.tables = new Map();
        /** @type {Map<string, Set<string>>} eventName → Set of tableIds */
        this.eventMap = new Map();
        this.listenerRefs = new Map(); // track registered EventBus listeners for cleanup
    }

    /**
     * Scans and loads all drop table JSON files from `items/droptables/`.
     */
    loadAll() {
        this.tables.clear();
        this.eventMap.clear();

        const dtDir = path.join(__dirname, '../../items/droptables');
        if (!fs.existsSync(dtDir)) {
            logger.warn('[DropTableManager] droptables directory not found.');
            return;
        }

        const files = fs.readdirSync(dtDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(dtDir, file), 'utf-8');
                const def = JSON.parse(raw);

                if (!def.id || !Array.isArray(def.slots)) {
                    logger.warn(`[DropTableManager] Skipping invalid drop table: "${file}"`);
                    continue;
                }

                this.tables.set(def.id, Object.freeze(def));

                // Map trigger event to this table
                if (def.trigger) {
                    if (!this.eventMap.has(def.trigger)) {
                        this.eventMap.set(def.trigger, new Set());
                    }
                    this.eventMap.get(def.trigger).add(def.id);
                }
            } catch (err) {
                logger.error(`[DropTableManager] Failed to load drop table "${file}": ${err.message}`);
            }
        }

        logger.info(`[DropTableManager] Loaded ${this.tables.size} drop tables.`);
    }

    /**
     * Registers EventBus listeners for every drop table's trigger event.
     * Called once by LootEngine.init().
     * @param {Function} onTrigger Callback(tableId, guildId, userId, payload)
     */
    registerListeners(onTrigger) {
        for (const [eventName, tableIds] of this.eventMap.entries()) {
            const handler = (payload, meta) => {
                const { guildId, userId } = meta || {};
                if (!guildId || !userId) return;
                for (const tableId of tableIds) {
                    const table = this.tables.get(tableId);
                    if (table && table.enabled !== false) {
                        onTrigger(tableId, guildId, userId, payload).catch(err =>
                            logger.error(`[DropTableManager] Trigger "${eventName}" failed for table "${tableId}": ${err.message}`)
                        );
                    }
                }
            };
            eventBus.subscribe(eventName, handler, { plugin: 'drop-table-manager' });
            this.listenerRefs.set(eventName, handler);
            logger.info(`[DropTableManager] Registered listener for event "${eventName}"`);
        }
    }

    /**
     * Gets a drop table definition by ID.
     * @param {string} tableId
     * @returns {object|null}
     */
    get(tableId) {
        return this.tables.get(tableId) || null;
    }

    /**
     * Gets all drop table definitions.
     * @returns {object[]}
     */
    getAll() {
        return Array.from(this.tables.values());
    }

    /**
     * Gets all drop table IDs registered to a specific trigger event.
     * @param {string} eventName
     * @returns {string[]}
     */
    getForEvent(eventName) {
        const set = this.eventMap.get(eventName);
        return set ? Array.from(set) : [];
    }
}

module.exports = new DropTableManager();
