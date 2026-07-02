const alertManager = require('./alertManager');
const notificationManager = require('./notificationManager');
const quickActionRegistry = require('./quickActionRegistry');
const smartLiveUpdater = require('./smartLiveUpdater');
const overviewPage = require('../pages/OverviewPage');
const cardSystem = require('../components/CardSystem');
const logger = require('../../../utils/logger');
// Override older panelRenderer to use our new OverviewPage
const panelRenderer = require('../../owoAdminIntegration/services/panelRenderer');

class ControlCenterManager {
    constructor() {
        this.initialized = false;
    }

    init(client) {
        if (this.initialized) return;
        logger.info('[ControlCenter] Initializing Enterprise Control Center Shell...');

        alertManager.init();
        notificationManager.init();
        smartLiveUpdater.init(client);

        // Override overview renderer
        panelRenderer.registerPage('overview', async (guildId) => {
            return await overviewPage.render(guildId);
        });

        this.initialized = true;
        logger.info('[ControlCenter] Framework Initialized.');
    }

    getPluginApi() {
        return {
            registerCard: (title, rendererFn) => cardSystem.renderCard(title, rendererFn),
            registerOverviewWidget: (id, rendererFn) => overviewPage.registerWidget(id, rendererFn),
            registerQuickAction: (id, label, emoji, handler) => quickActionRegistry.register(id, label, emoji, handler)
        };
    }
}

module.exports = new ControlCenterManager();
