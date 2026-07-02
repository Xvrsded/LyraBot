const { Collection } = require('discord.js');
const logger = require('../../../utils/logger');

class QuickActionManager {
    constructor() {
        this.actions = new Collection();
    }

    register(id, label, icon, style, handler) {
        this.actions.set(id, { id, label, icon, style, handler });
        logger.debug(`[QuickActionManager] Registered action: ${id}`);
    }

    unregister(id) {
        this.actions.delete(id);
    }

    get(id) {
        return this.actions.get(id) || null;
    }

    getAll() {
        return Array.from(this.actions.values());
    }
}

module.exports = new QuickActionManager();
