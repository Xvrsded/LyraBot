const { Collection } = require('discord.js');
const logger = require('../../../utils/logger');

class PageManager {
    constructor() {
        /**
         * Registry format:
         * Key: `${panelId}:${pageId}`
         * Value: {
         *    id: string,
         *    panelId: string,
         *    render: Function(sessionData, interaction) => { embeds, components }
         * }
         */
        this.registry = new Collection();
    }

    /**
     * Registers a new page for a panel.
     */
    registerPage(panelId, pageDefinition) {
        if (!panelId || !pageDefinition || !pageDefinition.id || typeof pageDefinition.render !== 'function') {
            throw new Error('Invalid page definition. Must have id and render function.');
        }

        const page = {
            id: pageDefinition.id,
            panelId: panelId,
            render: pageDefinition.render
        };

        const key = `${panelId}:${page.id}`;
        this.registry.set(key, page);
        logger.debug(`[UI PageManager] Registered page: ${key}`);
        return page;
    }

    /**
     * Gets a page by panelId and pageId.
     */
    getPage(panelId, pageId) {
        return this.registry.get(`${panelId}:${pageId}`) || null;
    }
}

module.exports = new PageManager();
