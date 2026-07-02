const { Collection } = require('discord.js');
const logger = require('../../../utils/logger');

class LayoutManager {
    constructor() {
        this.layouts = new Collection();
        this._registerDefaults();
    }

    _registerDefaults() {
        this.register('default', { maxWidgetsPerRow: 2, compact: false });
        this.register('compact', { maxWidgetsPerRow: 3, compact: true });
        this.register('wide', { maxWidgetsPerRow: 1, compact: false });
    }

    register(id, config) {
        this.layouts.set(id, config);
        logger.debug(`[LayoutManager] Registered layout: ${id}`);
    }

    get(id) {
        return this.layouts.get(id) || this.layouts.get('default');
    }

    getAll() {
        return Array.from(this.layouts.values());
    }
}

module.exports = new LayoutManager();
