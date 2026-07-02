const eventBus = require('../../../services/eventBus');
const ExecutionContext = require('./executionContext');
const workflowRegistry = require('./workflowRegistry');
const dependencyResolver = require('./dependencyResolver');
const workflowScheduler = require('./workflowScheduler');
const workflowExecutor = require('./workflowExecutor');
const automationHealth = require('./automationHealth');
const automationMetrics = require('./automationMetrics');
const WorkflowExecution = require('../models/WorkflowExecution');
const logger = require('../../../utils/logger');

class AutomationManager {
    constructor() {
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        logger.info('[OwOAutomation] Initializing Enterprise OwO Automation Orchestrator...');

        this._registerEventHooks();

        this.enabledCache = {};
        
        // Hot Reload Configuration Listener
        eventBus.subscribe('configuration.updated', (data) => {
            if (data.category === 'automation') {
                this.enabledCache[data.guildId] = data.value.enabled;
                logger.info(`[OwOAutomation] Hot reloaded automation config for ${data.guildId}`);
            }
        });

        this.initialized = true;
        logger.info('[OwOAutomation] Framework Initialized.');
    }

    _registerEventHooks() {
        // Example: listen to a broad wildcard or specific events if EventBus supports it
        // We'll simulate listening to 'owo.*.completed' by exposing an execute method
        // But let's bind a generic listener pattern.
        
        // In this implementation, we will manually trigger this via context.automation.execute
        // because dynamically parsing wildcard events depends on EventBus capabilities.
    }

    async executeActivity(activity, guildId, memberId, channelId, payload, behaviorId = null) {
        try {
            // Check hot reload cache
            if (this.enabledCache && this.enabledCache[guildId] === false) {
                logger.debug(`[OwOAutomation] Automation disabled for guild ${guildId} via hot-reload cache`);
                return null;
            }

            const targetModules = workflowRegistry.getModulesForActivity(activity);
            if (!targetModules || targetModules.length === 0) {
                logger.debug(`[OwOAutomation] No workflow registered for activity: ${activity}`);
                return null;
            }

            const context = new ExecutionContext({
                guildId, memberId, channelId, activity, payload, behaviorId
            });

            const resolvedModules = dependencyResolver.resolve(targetModules);
            const waves = workflowScheduler.schedule(resolvedModules);

            const executionRecord = new WorkflowExecution({
                workflowId: `${activity}_${Date.now()}`,
                correlationId: context.correlationId,
                guildId: guildId,
                activity: activity,
                status: 'RUNNING',
                steps: []
            });
            await executionRecord.save();

            // Run in background so it doesn't block the caller
            workflowExecutor.executeWaves(executionRecord, context, waves).catch(err => {
                logger.error(`[OwOAutomation] Workflow background execution crashed: ${err.message}`);
            });

            return context.correlationId;
        } catch (error) {
            logger.error(`[OwOAutomation] Failed to start workflow for ${activity}:`, error);
            throw error;
        }
    }

    getPluginApi() {
        return {
            execute: (activity, guildId, memberId, channelId, payload, behaviorId) => 
                this.executeActivity(activity, guildId, memberId, channelId, payload, behaviorId),
            registerWorkflow: (activity, modules) => workflowRegistry.registerActivityWorkflow(activity, modules),
            registerExecutor: (moduleName, fn) => workflowExecutor.registerModule(moduleName, fn),
            getStatistics: () => automationMetrics.getStatistics(),
            getHealth: () => automationHealth.getHealthScore()
        };
    }
}

module.exports = new AutomationManager();
