const logger = require('../utils/logger');
const configService = require('./configService');
const setupEngine = require('./setupEngine');
const templateLoader = require('./templateLoader');
const cacheProvider = require('../utils/cache');
const mongoose = require('mongoose');
const auditService = require('./auditService');
const transactionPipeline = require('./transactionPipeline');
const rewardDistributor = require('./rewardDistributor');
const Wallet = require('../models/Wallet');
const LedgerEntry = require('../models/LedgerEntry');
const inventoryService = require('./inventoryService');
const itemUsagePipeline = require('./itemUsagePipeline');
const itemRegistry = require('./itemRegistry');
const marketplaceEngine = require('./marketplaceEngine');
const marketplaceSearch = require('./marketplaceSearch');
const uiManager = require('../modules/ui/services/uiManager');
const dashboardManager = require('../modules/dashboard/services/dashboardManager');
const owoDiscoveryManager = require('../modules/owoDiscovery/services/owoDiscoveryManager');
const owoBehaviorManager = require('../modules/owoBehavior/services/behaviorManager');
const automationManager = require('../modules/owoAutomation/services/automationManager');
const adminIntegrationManager = require('../modules/owoAdminIntegration/services/adminIntegrationManager');
const controlCenterManager = require('../modules/owoControlCenter/services/controlCenterManager');
const pipelineIntegrationManager = require('../modules/owoPipeline/services/pipelineIntegrationManager');
const gameplayManager = require('../modules/owoGameplay/services/gameplayManager');
const decisionManager = require('../modules/owoDecision/services/decisionManager');
const configCenterManager = require('../modules/configurationCenter/services/configCenterManager');
const installerEngine = require('../modules/setupWizard/services/installerEngine');
const persistenceService = require('../modules/setupWizard/services/persistenceService');
const validationService = require('../modules/setupWizard/services/validationService');
const PreviewPage = require('../modules/setupWizard/pages/PreviewPage');
const validationPipeline = require('../modules/integrationValidator/services/validationPipeline');
const syncEngine = require('../modules/integrationValidator/services/syncEngine');

class PluginContext {
    /**
     * Context container passed to plugin lifecycle methods.
     * @param {Client} client Discord Client instance
     * @param {object} pluginManager The PluginManager instance
     */
    constructor(client, pluginManager) {
        this.client = client;
        this.pluginManager = pluginManager;
        this.logger = logger;
        this.configService = configService;
        this.setupEngine = setupEngine;
        this.templateEngine = templateLoader;
        this.cache = cacheProvider;
        this.database = mongoose;
        this.audit = auditService; // Exposes audit.info(), audit.warn(), audit.error(), audit.security() to plugins

        // Economy Framework - all balance mutations MUST go through these
        this.economy = {
            deposit: transactionPipeline.deposit.bind(transactionPipeline),
            withdraw: transactionPipeline.withdraw.bind(transactionPipeline),
            transfer: transactionPipeline.transfer.bind(transactionPipeline),
            reward: rewardDistributor.reward.bind(rewardDistributor),
            distributeList: rewardDistributor.distributeList.bind(rewardDistributor),
            getWallet: (guildId, userId) => Wallet.findOne({ guildId, userId }),
            getLedger: (query, limit) => LedgerEntry.find(query).sort({ timestamp: -1 }).limit(limit || 10)
        };

        // Inventory Framework - all inventory mutations MUST go through these
        this.inventory = {
            add:          (guildId, userId, itemId, qty, meta, expiresAt) => inventoryService.add(guildId, userId, itemId, qty, meta, expiresAt),
            remove:       (guildId, userId, itemId, qty) => inventoryService.remove(guildId, userId, itemId, qty),
            use:          (guildId, userId, itemId, ctx) => itemUsagePipeline.use(guildId, userId, itemId, { client, ...ctx }),
            has:          (guildId, userId, itemId, qty) => inventoryService.has(guildId, userId, itemId, qty),
            get:          (guildId, userId, itemId) => inventoryService.get(guildId, userId, itemId),
            getAll:       (guildId, userId) => inventoryService.getAll(guildId, userId),
            registerItem: (definition) => itemRegistry.register(definition),
            getItem:      (itemId) => itemRegistry.get(itemId),
            getAllItems:   () => itemRegistry.getAll()
        };

        // UI Framework
        this.ui = {
            createPanel: (def) => uiManager.registerPanel(def),
            open: (interaction, panelId, pageId, data) => uiManager.open(interaction, panelId, pageId, data),
            close: (interaction) => uiManager.close(interaction),
            navigate: (interaction, panelId, pageId, data) => uiManager.navigation.navigate(interaction, panelId, pageId, data),
            registerPanel: (def) => uiManager.registerPanel(def),
            registerPage: (panelId, def) => uiManager.registerPage(panelId, def),
            registerComponent: () => { /* reserved for custom components */ },
            components: uiManager.components
        };

        // Panel Framework
        this.panel = null;

        // Dashboard Framework
        this.dashboard = dashboardManager.getPluginApi();

        // Auto Discovery
        this.owoDiscovery = owoDiscoveryManager.getPluginApi();

        // Behavior Mapping
        this.owoBehavior = owoBehaviorManager.getPluginApi();

        // Automation Orchestrator
        this.automation = automationManager.getPluginApi();

        // Admin Panel Integration
        this.adminIntegration = adminIntegrationManager.getPluginApi();

        // Control Center Shell
        this.controlCenter = controlCenterManager.getPluginApi();

        // OwO Activity Pipeline
        this.pipeline = pipelineIntegrationManager.getPluginApi();

        // OwO Gameplay Engine
        this.gameplay = {
            execute: async (g, u, a, p) => await gameplayManager.execute(g, u, a, p)
        };

        // OwO Decision Engine
        this.decision = decisionManager.getPluginApi();

        // Enterprise Configuration Center
        this.configuration = {
            get: async (guildId, path) => await configCenterManager.get(guildId, path),
            set: async (guildId, path, value) => await configCenterManager.set(guildId, path, value),
            reload: async (guildId) => await configCenterManager._loadGuild(guildId),
            subscribe: (path, cb) => {
                // Simplified mock logic for subscribing to specific paths via EventBus
                require('../services/eventBus').subscribe('configuration.updated', (data) => {
                    if (!path || path === `${data.category}.${data.key}` || path === data.category) {
                        cb(data);
                    }
                });
            }
        };

        // Module 22.2: Setup Wizard
        this.templates = {
            install: async (guildId, config) => {
                const state = await persistenceService.getState(guildId);
                state.configuration = config;
                return installerEngine.run(state, persistenceService, this.client);
            },
            preview: (templateId) => PreviewPage.render({ selectedTemplate: templateId }),
            validate: (guildContext) => validationService.validatePermissions(guildContext),
            cancel: async (guildId) => {
                const state = await persistenceService.getState(guildId);
                return installerEngine.cancel(state, persistenceService);
            },
            resume: async (guildId) => {
                const state = await persistenceService.getState(guildId);
                return installerEngine.run(state, persistenceService, this.client);
            }
        };

        // Module 22.3: Integration Validation
        this.integration = {
            validate: async (guildId) => await validationPipeline.run(guildId),
            sync: async (guildId) => {
                const state = await require('../modules/integrationValidator/models/IntegrationHealthState').findOne({ guildId });
                if (state) {
                    await syncEngine.autoFix(guildId, state.components);
                    await state.save();
                }
                return state;
            },
            health: async (guildId) => {
                return await require('../modules/integrationValidator/models/IntegrationHealthState').findOne({ guildId });
            },
            autoFix: async (guildId) => {
                const state = await require('../modules/integrationValidator/models/IntegrationHealthState').findOne({ guildId });
                if (state) return await syncEngine.autoFix(guildId, state.components);
                return 0;
            }
        };

        // Module 22.4: OwO Configuration UI
        this.owoConfiguration = {
            renderOverview: async (guildId) => await require('../modules/owoConfiguration/services/owoConfigPlugin').getPluginApi().renderOverview(guildId),
            renderGeneral: async (guildId) => await require('../modules/owoConfiguration/services/owoConfigPlugin').getPluginApi().renderGeneral(guildId),
            renderChannel: async (guildId, pageIndex) => await require('../modules/owoConfiguration/services/owoConfigPlugin').getPluginApi().renderChannel(guildId, pageIndex),
            renderParser: async (guildId) => await require('../modules/owoConfiguration/services/owoConfigPlugin').getPluginApi().renderParser(guildId),
            renderHealth: async (guildId) => await require('../modules/owoConfiguration/services/owoConfigPlugin').getPluginApi().renderHealth(guildId)
        };

        // Module 22.5: Leveling Configuration UI
        this.levelingConfiguration = {
            renderOverview: async (guildId) => await require('../modules/levelingConfiguration/services/levelingConfigPlugin').getPluginApi().renderOverview(guildId),
            renderXpConfig: async (guildId) => await require('../modules/levelingConfiguration/services/levelingConfigPlugin').getPluginApi().renderXpConfig(guildId),
            renderFormulaConfig: async (guildId) => await require('../modules/levelingConfiguration/services/levelingConfigPlugin').getPluginApi().renderFormulaConfig(guildId),
            renderRoleRewards: async (guildId, pageIndex) => await require('../modules/levelingConfiguration/services/levelingConfigPlugin').getPluginApi().renderRoleRewards(guildId, pageIndex),
            renderAnnouncement: async (guildId) => await require('../modules/levelingConfiguration/services/levelingConfigPlugin').getPluginApi().renderAnnouncement(guildId),
            renderLeaderboard: async (guildId) => await require('../modules/levelingConfiguration/services/levelingConfigPlugin').getPluginApi().renderLeaderboard(guildId),
            renderBlacklist: async (guildId, pageIndex) => await require('../modules/levelingConfiguration/services/levelingConfigPlugin').getPluginApi().renderBlacklist(guildId, pageIndex),
            renderAdvanced: async (guildId) => await require('../modules/levelingConfiguration/services/levelingConfigPlugin').getPluginApi().renderAdvanced(guildId)
        };

        // Module 17: Config Service API
        this.config = {
            get: async (guildId, key) => {
                const cfg = await configService.getConfig(guildId);
                return key.split('.').reduce((o, i) => o ? o[i] : null, cfg);
            },
            getAll: async (guildId) => await configService.getConfig(guildId),
            set: async (guildId, key, value) => await configService.updateConfig(guildId, key, value)
        };

        // Module 18: Real-Time Gateway API (Decommissioned)
        this.gateway = {
            broadcast: () => {}, // Disabled
            send: () => {} // Disabled
        };

        // Marketplace Framework - all trading MUST go through these
        this.market = {
            createListing: (guildId, sellerId, itemId, qty, price, opts) => marketplaceEngine.sell(guildId, sellerId, itemId, qty, price, opts),
            buy:           (guildId, buyerId, listingId, ctx) => marketplaceEngine.buy(guildId, buyerId, listingId, ctx),
            cancel:        (guildId, sellerId, listingId) => marketplaceEngine.cancel(guildId, sellerId, listingId),
            search:        (guildId, query) => marketplaceSearch.search(guildId, query),
            browse:        (guildId, options) => marketplaceSearch.browse(guildId, options)
        };
    }
}

module.exports = PluginContext;
