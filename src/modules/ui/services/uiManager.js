const panelManager = require('./panelManager');
const pageManager = require('./pageManager');
const componentManager = require('./componentManager');
const navigationManager = require('./navigationManager');
const sessionManager = require('./sessionManager');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');

class UIManager {
    constructor() {
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        
        logger.info('[UIManager] Initializing Enterprise Discord UI Framework...');
        
        // Expose components
        this.components = componentManager;

        // Expose navigation
        this.navigation = navigationManager;

        // Setup base pages or listeners if needed
        
        this.initialized = true;
        logger.info('[UIManager] Enterprise Discord UI Framework initialized.');
    }

    /**
     * Registers a new UI panel.
     */
    registerPanel(panelDefinition) {
        return panelManager.registerPanel(panelDefinition);
    }

    /**
     * Registers a new page for a panel.
     */
    registerPage(panelId, pageDefinition) {
        return pageManager.registerPage(panelId, pageDefinition);
    }

    /**
     * Opens a specific panel for a user on an interaction.
     * This acts as the entry point (e.g. from a Slash Command).
     */
    async open(interaction, panelId, pageId = 'index', contextData = {}) {
        eventBus.emit('ui.open', {
            userId: interaction.user.id,
            panelId,
            pageId
        });
        
        // Clear any existing timeout for this user context and set new one
        return this.navigation.navigate(interaction, panelId, pageId, contextData);
    }

    /**
     * Closes the current UI session and deletes the original message if possible.
     */
    async close(interaction) {
        const { guildId, channelId, user } = interaction;
        
        sessionManager.destroySession(guildId, channelId, user.id);
        
        eventBus.emit('ui.close', {
            userId: user.id
        });

        if (!interaction.replied && !interaction.deferred) {
            await interaction.update({ content: 'Session closed.', embeds: [], components: [] }).catch(() => {});
        } else {
            await interaction.editReply({ content: 'Session closed.', embeds: [], components: [] }).catch(() => {});
        }
    }
}

module.exports = new UIManager();
