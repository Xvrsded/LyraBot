const widgetRegistry = require('../registry/widgetRegistry');
const layoutManager = require('../registry/layoutManager');
const quickActionManager = require('../registry/quickActionManager');
const dashboardScheduler = require('./dashboardScheduler');
const logger = require('../../../utils/logger');
const eventBus = require('../../../services/eventBus');

class DashboardManager {
    constructor() {
        this.initialized = false;
    }

    init(client) {
        if (this.initialized) return;

        logger.info('[DashboardManager] Initializing Enterprise Dashboard & Widget Framework...');
        
        widgetRegistry.reload();

        // Default Quick Actions
        quickActionManager.register('ui:dashboard:qa:overview', 'Overview', '📊', 2);
        quickActionManager.register('ui:dashboard:qa:config', 'Config', '⚙️', 2);
        quickActionManager.register('ui:dashboard:qa:plugins', 'Plugins', '🧩', 2);

        eventBus.subscribe('bot.ready', () => {
            dashboardScheduler.start(client);
        }, 'dashboard');

        this.initialized = true;
        logger.info('[DashboardManager] Framework Initialized.');
    }

    getPluginApi() {
        return {
            registerWidget: (metadata) => widgetRegistry.register(metadata),
            unregisterWidget: (id) => widgetRegistry.unregister(id),
            registerLayout: (id, config) => layoutManager.register(id, config),
            registerQuickAction: (id, label, icon, style) => quickActionManager.register(id, label, icon, style),
            reloadWidgets: () => widgetRegistry.reload()
        };
    }
}

module.exports = new DashboardManager();
