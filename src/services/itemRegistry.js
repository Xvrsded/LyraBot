const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Rarity priority for sorting
const RARITY_ORDER = {
    Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5
};

// Valid item categories
const VALID_CATEGORIES = [
    'Consumable', 'Material', 'Quest Item', 'Pet Item', 'Loot Box',
    'Key', 'Weapon', 'Armor', 'Cosmetic', 'Collectible', 'Currency Item'
];

class ItemRegistry {
    constructor() {
        /** @type {Map<string, object>} itemId → ItemDefinition */
        this.items = new Map();
        this.loaded = false;
    }

    /**
     * Scans all item JSON files under the `items/` project root directory recursively.
     * Skip files inside `droptables/` subdirectory (handled by DropTableManager).
     */
    loadAll() {
        this.items.clear();

        const itemsDir = path.join(__dirname, '../../items');
        if (!fs.existsSync(itemsDir)) {
            logger.warn(`[ItemRegistry] Items directory not found at: ${itemsDir}`);
            this.loaded = true;
            return;
        }

        let count = 0;
        this._scanDir(itemsDir, count);
        this.loaded = true;
        logger.info(`[ItemRegistry] Loaded ${this.items.size} item definitions.`);
    }

    /**
     * Recursively scans a directory for item JSON files.
     * @private
     */
    _scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // Skip droptables subdir — handled by DropTableManager
                if (entry.name === 'droptables') continue;
                this._scanDir(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.json')) {
                this._loadFile(fullPath);
            }
        }
    }

    /**
     * Parses and validates a single item JSON file.
     * @private
     */
    _loadFile(filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const def = JSON.parse(raw);

            // Validate required fields
            if (!def.id || !def.name || !def.category || !def.rarity) {
                logger.warn(`[ItemRegistry] Skipping invalid item (missing id/name/category/rarity): "${path.basename(filePath)}"`);
                return;
            }

            // Validate category
            if (!VALID_CATEGORIES.includes(def.category)) {
                logger.warn(`[ItemRegistry] Unknown category "${def.category}" in item "${def.id}". Proceeding anyway.`);
            }

            // Validate rarity
            if (!(def.rarity in RARITY_ORDER)) {
                logger.warn(`[ItemRegistry] Unknown rarity "${def.rarity}" in item "${def.id}". Proceeding anyway.`);
            }

            // Apply defaults
            def.stackable  = def.stackable  ?? true;
            def.maxStack   = def.maxStack   ?? 99;
            def.tradable   = def.tradable   ?? true;
            def.sellable   = def.sellable   ?? true;
            def.droppable  = def.droppable  ?? true;
            def.usable     = def.usable     ?? false;
            def.effects    = def.effects    ?? [];
            def.metadata   = def.metadata   ?? {};

            this.items.set(def.id, Object.freeze(def));
        } catch (err) {
            logger.error(`[ItemRegistry] Failed to load item file "${filePath}": ${err.message}`);
        }
    }

    /**
     * Registers a single item definition at runtime (plugin API).
     * @param {object} definition
     */
    register(definition) {
        if (!definition.id || !definition.name) {
            throw new Error('[ItemRegistry] Definition must have id and name.');
        }
        this.items.set(definition.id, Object.freeze({ ...definition }));
        logger.info(`[ItemRegistry] Registered item: "${definition.id}"`);
    }

    /**
     * Gets a single item definition by ID.
     * @param {string} itemId
     * @returns {object|null}
     */
    get(itemId) {
        return this.items.get(itemId) || null;
    }

    /**
     * Gets all loaded item definitions.
     * @returns {object[]}
     */
    getAll() {
        return Array.from(this.items.values());
    }

    /**
     * Gets all items in a given category.
     * @param {string} category
     * @returns {object[]}
     */
    getByCategory(category) {
        return this.getAll().filter(i => i.category === category);
    }

    /**
     * Gets all items with a given rarity.
     * @param {string} rarity
     * @returns {object[]}
     */
    getByRarity(rarity) {
        return this.getAll().filter(i => i.rarity === rarity);
    }

    /**
     * Gets the rarity sort order for a rarity name.
     * @param {string} rarity
     * @returns {number}
     */
    getRarityOrder(rarity) {
        return RARITY_ORDER[rarity] ?? -1;
    }
}

module.exports = new ItemRegistry();
