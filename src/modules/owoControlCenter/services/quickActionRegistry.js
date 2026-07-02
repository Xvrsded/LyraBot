const logger = require('../../../utils/logger');

class QuickActionRegistry {
    constructor() {
        this.actions = new Map();
    }

    register(id, label, emoji, handler) {
        this.actions.set(id, { label, emoji, handler });
        logger.debug(`[QuickActionRegistry] Registered action: ${id}`);
    }

    getActions() {
        return Array.from(this.actions.entries()).map(([id, data]) => ({
            id,
            label: data.label,
            emoji: data.emoji
        }));
    }

    async execute(id, context) {
        if (!this.actions.has(id)) throw new Error(`Quick action ${id} not found.`);
        return await this.actions.get(id).handler(context);
    }
}

module.exports = new QuickActionRegistry();
