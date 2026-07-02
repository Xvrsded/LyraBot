const { Collection } = require('discord.js');
const logger = require('../../../utils/logger');

class PanelManager {
    constructor() {
        /**
         * Registry format:
         * Key: panelId
         * Value: {
         *    id: string,
         *    title: string,
         *    description: string,
         *    icon: string,
         *    permissions: Array<string>,
         *    pages: Array<string>,
         *    parentPanel: string,
         *    components: Array<object>
         * }
         */
        this.registry = new Collection();
    }

    /**
     * Registers a new panel.
     */
    registerPanel(panelDefinition) {
        if (!panelDefinition || !panelDefinition.id) {
            throw new Error('Panel definition must contain a valid id.');
        }

        const panel = {
            id: panelDefinition.id,
            title: panelDefinition.title || 'Panel',
            description: panelDefinition.description || '',
            icon: panelDefinition.icon || '📌',
            permissions: panelDefinition.permissions || [],
            pages: panelDefinition.pages || ['index'],
            parentPanel: panelDefinition.parentPanel || null,
            components: panelDefinition.components || []
        };

        this.registry.set(panel.id, panel);
        logger.debug(`[UI PanelManager] Registered panel: ${panel.id}`);
        return panel;
    }

    /**
     * Gets a panel by ID.
     */
    getPanel(panelId) {
        return this.registry.get(panelId) || null;
    }
}

module.exports = new PanelManager();
