const overviewPage = require('../pages/OverviewPage');
const behaviorPage = require('../pages/BehaviorPage');
const automationPage = require('../pages/AutomationPage');
const configurationPage = require('../pages/ConfigurationPage');
const logger = require('../../../utils/logger');

class PanelRenderer {
    constructor() {
        this.pluginPages = new Map();
    }

    registerPage(pageId, pageRenderer) {
        this.pluginPages.set(pageId, pageRenderer);
    }

    async renderPage(guildId, pageId) {
        const pluginContext = require('../../../services/pluginContext');
        try {
            switch (pageId) {
                case 'overview': {
                    const health = pluginContext.automation ? await pluginContext.automation.getHealth() : 100;
                    const stats = pluginContext.automation ? await pluginContext.automation.getStatistics() : [];
                    return overviewPage.render(guildId, { 
                        healthScore: health, 
                        activeWorkflows: stats.length, 
                        failedWorkflows: stats.reduce((a, b) => a + b.failures, 0) 
                    });
                }
                case 'behavior': {
                    // Pull from behavior engine
                    // Actually, the real behavior engine state could be fetched here.
                    return behaviorPage.render(guildId, { behaviorMap: [], missingBehaviors: [] });
                }
                case 'automation': {
                    const stats = pluginContext.automation ? await pluginContext.automation.getStatistics() : [];
                    return automationPage.render(guildId, { stats });
                }
                case 'configuration': {
                    return configurationPage.render(guildId, {});
                }
                default: {
                    if (this.pluginPages.has(pageId)) {
                        const renderer = this.pluginPages.get(pageId);
                        return await renderer(guildId);
                    }
                    // Fallback to overview
                    return await this.renderPage(guildId, 'overview');
                }
            }
        } catch (e) {
            logger.error(`[PanelRenderer] Failed to render page ${pageId}:`, e);
            return overviewPage.render(guildId, { healthScore: 0, activeWorkflows: 0, failedWorkflows: 0 });
        }
    }
}

module.exports = new PanelRenderer();
