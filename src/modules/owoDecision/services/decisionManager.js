const decisionEngine = require('./decisionEngine');
const alertEngine = require('./alertEngine');
const recommendationEngine = require('./recommendationEngine');
const reminderEngine = require('./reminderEngine');
const decisionMetrics = require('./decisionMetrics');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');

// Load initial rules
const activityRules = require('../rules/activityRules.json');
const healthRules = require('../rules/healthRules.json');
const recommendationRules = require('../rules/recommendationRules.json');

class DecisionManager {
    constructor() {
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        logger.info('[OwODecision] Initializing Enterprise Decision Engine...');

        decisionEngine.loadRules([activityRules, healthRules, recommendationRules]);

        // Wire EventBus listeners to triggers
        eventBus.subscribe('gameplay.completed', (data) => {
            decisionEngine.evaluate('gameplay.completed', data.context, data);
        });

        eventBus.subscribe('gameplay.rewarded', (data) => {
            decisionEngine.evaluate('gameplay.rewarded', data.context, data);
        });

        eventBus.subscribe('pipeline.failed', (data) => {
            decisionEngine.evaluate('pipeline.failed', data.context, data);
        });

        // Register Control Center Card
        const controlCenterApi = require('../../../services/pluginContext').dashboard;
        const decisionCardRenderer = require('../integration/decisionCardRenderer');
        if (controlCenterApi && controlCenterApi.registerOverviewWidget) {
            controlCenterApi.registerOverviewWidget('Decision Center', decisionCardRenderer);
        }

        this.initialized = true;
        logger.info('[OwODecision] Decision Engine successfully wired.');
    }

    getPluginApi() {
        return {
            evaluate: async (trigger, context, payload) => await decisionEngine.evaluate(trigger, context, payload),
            registerRule: (rule) => decisionEngine.registerRule(rule),
            registerRecommendation: (context, msg) => recommendationEngine.recommend(context, msg),
            raiseAlert: (context, msg, level) => alertEngine.raiseAlert(context, msg, level),
            scheduleReminder: (context, msg, delay) => reminderEngine.scheduleReminder(context, msg, delay),
            getMetrics: () => decisionMetrics.metrics
        };
    }
}

module.exports = new DecisionManager();
