const widgetRegistry = require('../registry/widgetRegistry');
const logger = require('../../../utils/logger');

class WidgetManager {
    /**
     * Resolves the list of active widgets for a guild based on template/plugins.
     * @param {Guild} guild 
     * @param {string} template 
     */
    resolveWidgets(guild, template = 'default') {
        const all = widgetRegistry.getAll();
        
        // For now, return all sorted by priority
        // In the future, filter by active plugins or template
        return all.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    /**
     * Finds the lowest common refresh interval for a set of widgets.
     */
    calculateRefreshInterval(widgets) {
        if (!widgets || widgets.length === 0) return 60; // default 60s
        let min = 60;
        for (const w of widgets) {
            if (w.refresh && w.refresh < min) min = w.refresh;
        }
        return min < 5 ? 5 : min; // Absolute minimum 5 seconds to prevent rate limits
    }
}

module.exports = new WidgetManager();
