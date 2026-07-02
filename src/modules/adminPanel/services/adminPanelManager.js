const panelRegistry = require('../registry/panelRegistry');
const panelInstaller = require('./panelInstaller');
const panelUpdater = require('./panelUpdater');
const panelRecovery = require('./panelRecovery');
const logger = require('../../../utils/logger');
const eventBus = require('../../../services/eventBus');

class AdminPanelManager {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initializes the Admin Panel Generator framework.
     */
    init(client) {
        if (this.initialized) return;
        
        logger.info('[AdminPanelManager] Initializing Enterprise Dynamic Admin Panel Generator...');
        
        // Load base panels
        panelRegistry.reload();

        // Dynamically register UI placeholders for any base panel that is not yet implemented
        const uiManager = require('../../ui/services/uiManager');
        const pageManager = require('../../ui/services/pageManager');
        const panelManager = require('../../ui/services/panelManager');
        const { EmbedBuilder } = require('discord.js');

        for (const metadata of panelRegistry.getAll()) {
            const id = metadata.id;
            if (!panelManager.getPanel(id)) {
                // Panel UI not found, throw warning
                logger.warn(`[AdminPanelManager] Panel "${id}" registered but has no UI Page/Renderer. Button may fail if clicked.`);
            }
        }

        // Register recovery hook on ready
        eventBus.subscribe('bot.ready', () => {
            panelRecovery.scanAndRecover(client);
        }, 'adminPanel');

        // Hook into SetupEngine completion
        eventBus.subscribe('setup.completed', async ({ guildId, templateId }) => {
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (guild) {
                await panelInstaller.install(guild, templateId);
            }
        }, 'adminPanel');

        this.initialized = true;
        logger.info('[AdminPanelManager] Enterprise Dynamic Admin Panel Generator initialized.');
    }

    /**
     * Exposes Panel API for Plugin Context
     */
    getPluginApi() {
        return {
            register: (metadata) => panelRegistry.register(metadata),
            unregister: (panelId) => panelRegistry.unregister(panelId),
            update: (panelId, metadata) => panelRegistry.update(panelId, metadata),
            reload: () => panelRegistry.reload()
        };
    }
}

module.exports = new AdminPanelManager();
