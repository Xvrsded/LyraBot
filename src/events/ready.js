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
        
        // Seed default log channel ID
        const settingsService = require('../services/settingsService');
        settingsService.get('log_channel_id').then(async (val) => {
            if (!val || val === '1517342247199444992') {
                await settingsService.set('log_channel_id', '1534624789065498795');
            }
        }).catch((err) => console.error('Error seeding default log channel:', err));
        
        client.user.setPresence({
            activities: [{ name: 'LyraBlox Store', type: ActivityType.Watching }],
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

        // Initialize Copay Service Cron Job
        const copayService = require('../services/copayService');
        const jobManager = require('../services/jobManager');
        jobManager.registerJob('copay_eligibility_check', copayService.handleEligibilityCheck);
        jobManager.scheduleCron('copay_eligibility_check', '*/5 * * * *', {}).catch(err => {
            logger.error('[Ready Event] Copay cron scheduling failed:', err);
        });

        // Initialize Verification System
        const verificationService = require('../services/verificationService');
        verificationService.syncPanel(client);

        // Sync MM Rekber Panel
        const mmRekberService = require('../services/mmRekberService');
        mmRekberService.syncMMPanel(client);

        // Sync Limited Item Panel
        const limitedItemService = require('../services/limitedItemService');
        limitedItemService.syncLimitedPanel(client);

        // Sync Voice Statuses
        const voiceStatusService = require('../services/voiceStatusService');
        voiceStatusService.updateAllVoiceStatuses(client);

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

        // Initialize Configuration Center
        const configurationCenter = require('../modules/configurationCenter');
        configurationCenter.init();
        
        logger.info('[Ready Event] Enterprise Runtime Pipeline Enabled.');

        // Emit bot.ready event to trigger recovery and updates
        const eventBus = require('../services/eventBus');
        eventBus.emit('bot.ready', client);


        // Enterprise API and Gateway frameworks have been decommissioned.
        // See src/archive for disabled code.

        setTimeout(() => {
            const { seedRobuxPackages, syncVilogPanel, syncVisendPanel, syncGigPanel } = require('../services/robuxService');
            seedRobuxPackages()
                .then(() => syncVilogPanel(client))
                .then(() => syncVisendPanel(client))
                .then(() => syncGigPanel(client))
                .catch(err => console.error('[READY] Error syncing Robux catalogs:', err));
            
            const copayService = require('../services/copayService');
            copayService.syncCopayPanel(client);
        }, 5000);

        setTimeout(() => {
            const dashboardService = require('../services/dashboardService');
            dashboardService.syncDashboard(client);
            
            const leaderboardService = require('../services/leaderboardService');
            leaderboardService.syncTransactionLogs(client).then(() => {
                leaderboardService.syncAllCustomerTiers(client);
            });
        }, 3000);
    },
};
