const stagesMetadata = require('../registry/gameplayStages.json');
const validationEngine = require('../engines/validationEngine');
const cooldownEngine = require('../engines/cooldownEngine');
const questAdapter = require('../engines/questEngineAdapter');
const achievementAdapter = require('../engines/achievementEngineAdapter');
const progressionAdapter = require('../engines/progressionEngineAdapter');
const economyAdapter = require('../engines/economyEngineAdapter');
const inventoryAdapter = require('../engines/inventoryEngineAdapter');
const statisticsEngine = require('../engines/statisticsEngine');
const notificationEngine = require('../engines/notificationEngine');
const dashboardEngine = require('../engines/dashboardEngine');
const gameplayMetrics = require('./gameplayMetrics');
const pipelineIntegrationManager = require('../../owoPipeline/services/pipelineIntegrationManager');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');

class GameplayManager {
    constructor() {
        this.initialized = false;
        this.engines = {
            ValidationEngine: validationEngine,
            CooldownEngine: cooldownEngine,
            QuestAdapter: questAdapter,
            AchievementAdapter: achievementAdapter,
            ProgressionAdapter: progressionAdapter,
            EconomyAdapter: economyAdapter,
            InventoryAdapter: inventoryAdapter,
            StatisticsEngine: statisticsEngine,
            NotificationEngine: notificationEngine,
            DashboardEngine: dashboardEngine
        };
    }

    init() {
        if (this.initialized) return;
        logger.info('[OwOGameplay] Initializing Enterprise Gameplay Engine...');

        const pipelineApi = pipelineIntegrationManager.getPluginApi();

        for (const [stageId, meta] of Object.entries(stagesMetadata)) {
            if (!meta.enabled) continue;
            
            const engineInstance = this.engines[stageId];
            if (!engineInstance) {
                logger.warn(`[OwOGameplay] Engine ${stageId} is in registry but not implemented!`);
                continue;
            }

            pipelineApi.registerStage(stageId, engineInstance, {
                abortOnFail: meta.abortOnFail,
                isParallel: meta.isParallel
            });
        }

        // Listen for pipeline events to update gameplay metrics
        eventBus.subscribe('pipeline.completed', () => gameplayMetrics.recordSuccess(10));
        eventBus.subscribe('pipeline.failed', () => gameplayMetrics.recordFailure());
        eventBus.subscribe('pipeline.halted', () => gameplayMetrics.recordHalt());

        // Register Control Center Card
        const controlCenterApi = require('../../../services/pluginContext').dashboard;
        const gameplayCardRenderer = require('../integration/gameplayCardRenderer');
        if (controlCenterApi && controlCenterApi.registerOverviewWidget) {
            controlCenterApi.registerOverviewWidget('Gameplay Status', gameplayCardRenderer);
        }

        this.initialized = true;
        logger.info('[OwOGameplay] Gameplay Engines successfully wired to Pipeline.');
    }

    async execute(guildId, userId, activity, payload) {
        const pipelineApi = pipelineIntegrationManager.getPluginApi();
        return await pipelineApi.executeActivity(guildId, userId, activity, payload);
    }
}

module.exports = new GameplayManager();
