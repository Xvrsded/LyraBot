const { Events, ActivityType } = require('discord.js');
const configService = require('../services/configService');
const pluginManager = require('../services/pluginManager');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ClientReady,
    once: true,
    
    /**
     * Executes when the client becomes ready.
     * @param {Client} client Discord Client object
     * @returns {void}
     */
    execute(client) {
        logger.info(`🤖 Login sebagai ${client.user.tag}`);
        
        client.user.setPresence({
            activities: [{ name: 'Winter Community', type: ActivityType.Watching }],
            status: 'online',
        });
        
        // Sync database configs
        configService.sync(client).catch(err => {
            logger.error('[Ready Event] Config synchronization failed:', err);
        });

        // Initialize plugin framework
        pluginManager.init(client).catch(err => {
            logger.error('[Ready Event] Plugin initialization failed:', err);
        });

        // Initialize scheduler framework
        const scheduler = require('../services/scheduler');
        scheduler.init(client).catch(err => {
            logger.error('[Ready Event] Scheduler initialization failed:', err);
        });

        // Initialize audit & logging framework
        const auditService = require('../services/auditService');
        auditService.init(client);

        // Initialize quest engine
        const questEngine = require('../services/questEngine');
        questEngine.init(client);

        // Initialize progression engine
        const progressionEngine = require('../services/progressionEngine');
        progressionEngine.init(client);

        // Initialize inventory engine (item expiry scanner)
        const inventoryEngine = require('../services/inventoryEngine');
        inventoryEngine.init(client);

        // Initialize loot engine (loads item registry + drop tables + EventBus listeners)
        const lootEngine = require('../services/lootEngine');
        lootEngine.init(client);

        // Initialize marketplace engine (expiry scanner for listings)
        const marketplaceEngine = require('../services/marketplaceEngine');
        marketplaceEngine.init(client);
        
        // Initialize UI Engine
        const uiManager = require('../modules/ui/services/uiManager');
        uiManager.init();

        // Initialize Enterprise Modules (Reviving Dead Code)
        const pipelineIntegrationManager = require('../modules/owoPipeline/services/pipelineIntegrationManager');
        pipelineIntegrationManager.init();

        const owoDiscoveryManager = require('../modules/owoDiscovery/services/owoDiscoveryManager');
        owoDiscoveryManager.init(client);

        const behaviorManager = require('../modules/owoBehavior/services/behaviorManager');
        behaviorManager.init(client);

        const automationManager = require('../modules/owoAutomation/services/automationManager');
        automationManager.init();

        const decisionManager = require('../modules/owoDecision/services/decisionManager');
        decisionManager.init();

        // Initialize Admin Panel Engine
        const adminPanelManager = require('../modules/adminPanel/services/adminPanelManager');
        adminPanelManager.init(client);

        // Initialize Configuration Center
        const configurationCenter = require('../modules/configurationCenter');
        configurationCenter.init();
        
        // Initialize Master Runtime Wiring
        const runtimeWiring = require('../modules/adminPanel/services/RuntimeWiring');
        // We need pluginContext which is initialized inside pluginManager
        const PluginContext = require('../services/pluginContext');
        const pluginCtx = new PluginContext(client, pluginManager);
        runtimeWiring.init(client, pluginCtx);
        
        logger.info('[Ready Event] Enterprise Runtime Pipeline Enabled.');

        // Emit bot.ready event to trigger recovery and updates
        const eventBus = require('../services/eventBus');
        eventBus.emit('bot.ready', client);


        // Enterprise API and Gateway frameworks have been decommissioned.
        // See src/archive for disabled code.

        // Update embed every 10 minutes (600000 ms)
        setInterval(() => {
            const { updateStoreEmbed } = require('../services/storeService');
            const { updateAdminPanel } = require('../services/adminService');
            updateStoreEmbed(client);
            updateAdminPanel(client);
        }, 10 * 60 * 1000);
        
        // Initial update
        setTimeout(() => {
            const { updateStoreEmbed } = require('../services/storeService');
            updateStoreEmbed(client);
        }, 5000);
        
        setTimeout(() => {
            const { updateAdminPanel } = require('../services/adminService');
            updateAdminPanel(client);
        }, 10000);
    },
};
