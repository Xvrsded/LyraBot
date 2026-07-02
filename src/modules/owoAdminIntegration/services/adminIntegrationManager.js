const panelOrchestrator = require('./panelOrchestrator');
const panelLiveUpdater = require('./panelLiveUpdater');
const panelRecovery = require('./panelRecovery');
const panelSessionSync = require('./panelSessionSync');
const panelRenderer = require('./panelRenderer');
const logger = require('../../../utils/logger');

class AdminIntegrationManager {
    constructor() {
        this.initialized = false;
    }

    init(client) {
        if (this.initialized) return;
        logger.info('[OwOAdminIntegration] Initializing Enterprise Admin Integration...');

        panelOrchestrator.init(client);
        panelLiveUpdater.init(client);
        panelRecovery.init(client);

        // Bind interactions
        client.on('interactionCreate', async (interaction) => {
            try {
                await panelSessionSync.handleInteraction(interaction);
            } catch (e) {
                logger.error('[OwOAdminIntegration] Error handling interaction:', e);
            }
        });

        this.initialized = true;
        logger.info('[OwOAdminIntegration] Framework Initialized.');
    }

    getPluginApi() {
        return {
            registerPage: (pageId, rendererFn) => panelRenderer.registerPage(pageId, rendererFn),
            refreshPanel: (guildId) => panelLiveUpdater.queueUpdate(guildId)
        };
    }
}

module.exports = new AdminIntegrationManager();
