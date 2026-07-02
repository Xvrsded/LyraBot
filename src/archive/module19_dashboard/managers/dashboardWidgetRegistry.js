/**
 * dashboardWidgetRegistry.js — Dynamic registry for dashboard widgets and pages.
 */

class DashboardWidgetRegistry {
    constructor() {
        this.widgets = new Map();
        this.pages = new Map();
    }

    /**
     * Registers a new dashboard widget.
     * @param {Object} definition 
     * { id: 'economy_overview', title: 'Economy Overview', component: 'EconomyWidget', props: {}, defaultWidth: 4, defaultHeight: 2 }
     */
    registerWidget(definition) {
        if (!definition.id) throw new Error('Widget definition must have an ID');
        this.widgets.set(definition.id, definition);
    }

    /**
     * Registers a new full page in the dashboard sidebar.
     * @param {Object} definition
     * { id: 'market_browser', title: 'Marketplace', icon: 'StoreIcon', route: '/market' }
     */
    registerPage(definition) {
        if (!definition.id) throw new Error('Page definition must have an ID');
        this.pages.set(definition.id, definition);
    }

    /**
     * Returns all registered widgets, formatting them for the frontend UI.
     */
    getAllWidgets() {
        return Array.from(this.widgets.values());
    }

    /**
     * Returns all registered pages (sidebar items).
     */
    getAllPages() {
        return Array.from(this.pages.values());
    }
}

module.exports = new DashboardWidgetRegistry();
