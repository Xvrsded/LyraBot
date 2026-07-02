const PluginLifecycle = require('../../services/pluginLifecycle');
const logger = require('../../utils/logger');
const jobManager = require('../../services/jobManager');
const eventBus = require('../../services/eventBus');

class TestPlugin extends PluginLifecycle {
    onLoad(context) {
        super.onLoad(context);
        logger.info('[TestPlugin] onLoad executed.');

        // 1. Emit load audit log
        this.context.audit.info('test-plugin', 'PLUGIN_LOADED', {
            metadata: { message: 'TestPlugin loaded successfully.' }
        });

        // 2. Subscribe to a wildcard event pattern
        eventBus.subscribe('test.*', (ctx) => {
            logger.info(`[TestPlugin] Wildcard subscriber fired for: "${ctx.eventName}". Context eventId: ${ctx.eventId}. CorrelationId: ${ctx.correlationId}. Payload: ${JSON.stringify(ctx.payload)}`);
        }, 'test-plugin');

        // 3. Register background job callback handler
        jobManager.registerJob('test-cron-job', async (ctx) => {
            logger.info(`[TestPlugin] Running job callback: "${ctx.name}"`);
            
            const runs = ctx.data.runs || 0;
            ctx.data.runs = runs + 1;

            // Emit a custom event to the EventBus
            eventBus.emit('test.run', { runs: ctx.data.runs }, { plugin: 'test-plugin' });

            // Induce a mock failure every 3rd run to test retry logic
            if (runs % 3 === 0) {
                throw new Error('Induced failure to verify Retry Policy & DLQ!');
            }
        });
    }

    async onEnable() {
        logger.info('[TestPlugin] onEnable executed.');

        // 4. Emit enable audit log
        this.context.audit.info('test-plugin', 'PLUGIN_ENABLED', {
            metadata: { message: 'TestPlugin enabled and active.' }
        });

        // Schedule a persistent cron job executing every 1 minute
        try {
            await jobManager.scheduleCron(
                'test-cron-job', 
                '*/1 * * * *', 
                { runs: 1 }, 
                { maxRetries: 2, retryDelay: 3000 }
            );
            logger.info('[TestPlugin] Scheduled persistent job "test-cron-job" successfully.');
        } catch (err) {
            logger.error('[TestPlugin] Failed to schedule cron job:', err.message);
        }
    }

    onReady() {
        logger.info('[TestPlugin] onReady executed. Discord client is active.');
    }

    onDisable() {
        logger.info('[TestPlugin] onDisable executed.');
        
        // Clean up handler from manager memory
        jobManager.unregisterJob('test-cron-job');

        // Clean up subscribers from EventBus
        eventBus.unsubscribePlugin('test-plugin');
    }
}

module.exports = TestPlugin;
