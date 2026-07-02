const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');

class PanelRegistry {
    constructor() {
        this.panels = new Collection();
    }

    /**
     * Registers a panel into the registry.
     */
    register(metadata) {
        if (!metadata || !metadata.id) {
            throw new Error('[PanelRegistry] Metadata must include a valid id.');
        }

        this.panels.set(metadata.id, metadata);
        logger.debug(`[PanelRegistry] Registered panel: ${metadata.id}`);
        return metadata;
    }

    /**
     * Unregisters a panel from the registry.
     */
    unregister(panelId) {
        if (this.panels.has(panelId)) {
            this.panels.delete(panelId);
            logger.debug(`[PanelRegistry] Unregistered panel: ${panelId}`);
            return true;
        }
        return false;
    }

    /**
     * Updates an existing panel's metadata.
     */
    update(panelId, metadataUpdates) {
        const existing = this.panels.get(panelId);
        if (!existing) {
            throw new Error(`[PanelRegistry] Panel ${panelId} not found.`);
        }

        const updated = { ...existing, ...metadataUpdates, id: panelId };
        this.panels.set(panelId, updated);
        logger.debug(`[PanelRegistry] Updated panel: ${panelId}`);
        return updated;
    }

    /**
     * Checks if a panel exists.
     */
    exists(panelId) {
        return this.panels.has(panelId);
    }

    /**
     * Gets a panel by ID.
     */
    get(panelId) {
        return this.panels.get(panelId) || null;
    }

    /**
     * Gets all registered panels as an array.
     */
    getAll() {
        return Array.from(this.panels.values());
    }

    /**
     * Reloads all JSON metadata from the base directory.
     */
    reload() {
        logger.info('[PanelRegistry] Reloading metadata panels...');
        this.panels.clear();
        
        const baseDir = path.join(__dirname, '../panels/base');
        if (fs.existsSync(baseDir)) {
            const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const filePath = path.join(baseDir, file);
                    delete require.cache[require.resolve(filePath)]; // Clear cache for live reload
                    const metadata = require(filePath);
                    this.register(metadata);
                } catch (error) {
                    logger.error(`[PanelRegistry] Failed to load ${file}:`, error);
                }
            }
        }
        logger.info(`[PanelRegistry] Reload complete. Loaded ${this.panels.size} panels.`);
    }
}

module.exports = new PanelRegistry();
