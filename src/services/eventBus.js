const logger = require('../utils/logger');

class EventBus {
    constructor() {
        this.subscribers = []; // Array of { pattern, handler, pluginName, once: boolean }
        this.middlewares = []; // Array of middleware functions: (context, next) => void
        this.recentEvents = []; // Queue of last 50 events for debugging/observability
        
        // Register default Logging & Metrics middlewares
        this.registerMiddleware(this.loggingMiddleware.bind(this));
        this.registerMiddleware(this.metricsMiddleware.bind(this));
    }

    /**
     * Subscribe a handler callback to an event pattern (supports wildcard e.g., 'owo.*' or '*').
     * @param {string} pattern The event pattern to match
     * @param {function} handler Callback function (receives eventContext)
     * @param {string} pluginName Origin plugin name
     * @returns {void}
     */
    subscribe(pattern, handler, pluginName = 'core') {
        this.subscribers.push({ pattern, handler, pluginName, once: false });
        logger.debug(`[EventBus] Plugin "${pluginName}" subscribed to "${pattern}"`);
    }

    /**
     * Subscribe a handler callback to run exactly once.
     * @param {string} pattern The event pattern to match
     * @param {function} handler Callback function
     * @param {string} pluginName Origin plugin name
     * @returns {void}
     */
    once(pattern, handler, pluginName = 'core') {
        this.subscribers.push({ pattern, handler, pluginName, once: true });
        logger.debug(`[EventBus] Plugin "${pluginName}" subscribed ONCE to "${pattern}"`);
    }

    /**
     * Unregisters all subscribers belonging to a specific plugin.
     * Crucial for clean plugin hot reloads.
     * @param {string} pluginName The plugin name
     * @returns {void}
     */
    unsubscribePlugin(pluginName) {
        const initialCount = this.subscribers.length;
        this.subscribers = this.subscribers.filter(sub => sub.pluginName !== pluginName);
        const removed = initialCount - this.subscribers.length;
        if (removed > 0) {
            logger.info(`[EventBus] Unregistered ${removed} subscribers for plugin: "${pluginName}"`);
        }
    }

    /**
     * Registers a custom middleware to intercept event emissions.
     * @param {function} middlewareFn Middleware function (context, next)
     */
    registerMiddleware(middlewareFn) {
        this.middlewares.push(middlewareFn);
    }

    /**
     * Synchronously emit an event across the bus, executing middlewares and matching handlers.
     * @param {string} eventName Name of the event (e.g. 'owo.hunt')
     * @param {object} payload Argument data
     * @param {object} contextOptions Metadata context details (plugin, guildId, userId, correlationId)
     * @returns {void}
     */
    emit(eventName, payload = {}, contextOptions = {}) {
        const context = this.buildContext(eventName, payload, contextOptions);
        this.runMiddlewareChain(context, () => {
            this.dispatchSync(eventName, context);
        });
    }

    /**
     * Asynchronously emit an event, allowing non-blocking concurrent handler runs.
     * @param {string} eventName Name of the event
     * @param {object} payload Argument data
     * @param {object} contextOptions Metadata context details
     * @returns {Promise<void>}
     */
    async emitAsync(eventName, payload = {}, contextOptions = {}) {
        const context = this.buildContext(eventName, payload, contextOptions);
        return new Promise((resolve) => {
            this.runMiddlewareChain(context, async () => {
                await this.dispatchAsync(eventName, context);
                resolve();
            });
        });
    }

    /**
     * Emits an event after a specific duration delay.
     * @param {string} eventName Name of the event
     * @param {object} payload Argument data
     * @param {number} delayMs Wait duration in milliseconds
     * @param {object} contextOptions Metadata context details
     * @returns {void}
     */
    emitDelayed(eventName, payload = {}, delayMs, contextOptions = {}) {
        setTimeout(() => {
            this.emit(eventName, payload, contextOptions);
        }, delayMs);
    }

    /**
     * Build standard event metadata block.
     * @private
     */
    buildContext(eventName, payload, options) {
        const correlationId = options.correlationId || `corr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        return {
            eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            eventName,
            plugin: options.plugin || 'core',
            guildId: options.guildId || null,
            userId: options.userId || null,
            timestamp: new Date(),
            payload,
            correlationId
        };
    }

    /**
     * Executes the middleware pipeline before dispatching events.
     * @private
     */
    runMiddlewareChain(context, targetDispatch) {
        let index = 0;
        const next = () => {
            if (index < this.middlewares.length) {
                const middleware = this.middlewares[index++];
                try {
                    middleware(context, next);
                } catch (err) {
                    logger.error('[EventBus Middleware Error]', err);
                    next(); // Continue chain on failures
                }
            } else {
                targetDispatch();
            }
        };
        next();
    }

    /**
     * Dispatches event to matching subscribers synchronously.
     * @private
     */
    dispatchSync(eventName, context) {
        const matches = this.getMatchingSubscribers(eventName);
        for (const sub of matches) {
            try {
                sub.handler(context);
                if (sub.once) this.removeSubscriber(sub);
            } catch (err) {
                logger.error(`[EventBus] Sync handler failed for event "${eventName}" from plugin "${sub.pluginName}":`, err.message);
                this.trackPluginError(sub.pluginName, err);
            }
        }
    }

    /**
     * Dispatches event to matching subscribers concurrently.
     * @private
     */
    async dispatchAsync(eventName, context) {
        const matches = this.getMatchingSubscribers(eventName);
        const promises = matches.map(async (sub) => {
            try {
                await sub.handler(context);
                if (sub.once) this.removeSubscriber(sub);
            } catch (err) {
                logger.error(`[EventBus] Async handler failed for event "${eventName}" from plugin "${sub.pluginName}":`, err.message);
                this.trackPluginError(sub.pluginName, err);
            }
        });
        await Promise.all(promises);
    }

    /**
     * Checks subscription pattern matching using wildcards.
     * @private
     */
    getMatchingSubscribers(eventName) {
        return this.subscribers.filter(sub => {
            const pattern = sub.pattern;
            if (pattern === '*' || pattern === eventName) return true;
            if (pattern.includes('*')) {
                const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
                const regex = new RegExp(regexPattern);
                return regex.test(eventName);
            }
            return false;
        });
    }

    /**
     * Removes once-listeners.
     * @private
     */
    removeSubscriber(sub) {
        const idx = this.subscribers.indexOf(sub);
        if (idx !== -1) this.subscribers.splice(idx, 1);
    }

    /**
     * Default Middleware: Logs all events to recent queues.
     * @private
     */
    loggingMiddleware(context, next) {
        logger.debug(`[EventBus Log] Event: "${context.eventName}" [ID: ${context.eventId}] Correlation: ${context.correlationId}`);
        
        // Add to debug history (keep max 50 events)
        this.recentEvents.push(context);
        if (this.recentEvents.length > 50) this.recentEvents.shift();
        
        next();
    }

    /**
     * Default Middleware: Collects basic execution metrics.
     * @private
     */
    metricsMiddleware(context, next) {
        const metricsService = require('./metricsService');
        if (metricsService && typeof metricsService.recordEvent === 'function') {
            metricsService.recordEvent(context.eventName);
        }
        next();
    }

    /**
     * Helper to track plugin error metrics.
     * @private
     */
    trackPluginError(pluginName, err) {
        const metricsService = require('./metricsService');
        if (metricsService && typeof metricsService.recordPluginError === 'function') {
            metricsService.recordPluginError(pluginName, err.message);
        }
    }
}

module.exports = new EventBus();
