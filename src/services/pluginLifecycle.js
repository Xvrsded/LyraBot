class PluginLifecycle {
    constructor() {
        /**
         * The plugin context container.
         * @type {PluginContext|null}
         */
        this.context = null;
    }

    /**
     * Called when the plugin is loaded into memory (but not enabled yet).
     * Ideal for registering setups, configurations, database models, etc.
     * @param {PluginContext} context The plugin context container
     * @returns {void|Promise<void>}
     */
    onLoad(context) {
        this.context = context;
    }

    /**
     * Called when the plugin is enabled.
     * Ideal for starting timers, event listeners, etc.
     * @returns {void|Promise<void>}
     */
    onEnable() {}

    /**
     * Called when the Discord Client has become ready and configs are synchronized.
     * @returns {void|Promise<void>}
     */
    onReady() {}

    /**
     * Called when the plugin is unloaded or disabled.
     * Must clean up all event listeners, timers, command registrations to prevent leaks.
     * @returns {void|Promise<void>}
     */
    onDisable() {}
}

module.exports = PluginLifecycle;
