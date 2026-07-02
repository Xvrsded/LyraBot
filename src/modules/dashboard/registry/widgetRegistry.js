const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');

class WidgetRegistry {
    constructor() {
        this.widgets = new Collection();
    }

    register(metadata) {
        if (!metadata || !metadata.id) {
            throw new Error('[WidgetRegistry] Metadata must include a valid id.');
        }
        this.widgets.set(metadata.id, metadata);
        logger.debug(`[WidgetRegistry] Registered widget: ${metadata.id}`);
        return metadata;
    }

    unregister(widgetId) {
        if (this.widgets.has(widgetId)) {
            this.widgets.delete(widgetId);
            logger.debug(`[WidgetRegistry] Unregistered widget: ${widgetId}`);
            return true;
        }
        return false;
    }

    update(widgetId, metadataUpdates) {
        const existing = this.widgets.get(widgetId);
        if (!existing) throw new Error(`[WidgetRegistry] Widget ${widgetId} not found.`);
        const updated = { ...existing, ...metadataUpdates, id: widgetId };
        this.widgets.set(widgetId, updated);
        logger.debug(`[WidgetRegistry] Updated widget: ${widgetId}`);
        return updated;
    }

    exists(widgetId) {
        return this.widgets.has(widgetId);
    }

    get(widgetId) {
        return this.widgets.get(widgetId) || null;
    }

    getAll() {
        return Array.from(this.widgets.values());
    }

    reload() {
        logger.info('[WidgetRegistry] Reloading widget metadata...');
        this.widgets.clear();
        
        const baseDir = path.join(__dirname, '../widgets');
        if (fs.existsSync(baseDir)) {
            const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const filePath = path.join(baseDir, file);
                    delete require.cache[require.resolve(filePath)];
                    const metadata = require(filePath);
                    this.register(metadata);
                } catch (error) {
                    logger.error(`[WidgetRegistry] Failed to load ${file}:`, error);
                }
            }
        }
        logger.info(`[WidgetRegistry] Reload complete. Loaded ${this.widgets.size} widgets.`);
    }
}

module.exports = new WidgetRegistry();
