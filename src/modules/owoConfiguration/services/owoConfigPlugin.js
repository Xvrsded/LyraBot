const OverviewPage = require('../pages/OverviewPage');
const GeneralConfigPage = require('../pages/GeneralConfigPage');
const ChannelConfigPage = require('../pages/ChannelConfigPage');
const ParserConfigPage = require('../pages/ParserConfigPage');
const HealthConfigPage = require('../pages/HealthConfigPage');

class OwoConfigPlugin {
    getPluginApi() {
        return {
            renderOverview: async (guildId) => await OverviewPage.render(guildId),
            renderGeneral: async (guildId) => await GeneralConfigPage.render(guildId),
            renderChannel: async (guildId, pageIndex) => await ChannelConfigPage.render(guildId, pageIndex),
            renderParser: async (guildId) => await ParserConfigPage.render(guildId),
            renderHealth: async (guildId) => await HealthConfigPage.render(guildId)
        };
    }
}

module.exports = new OwoConfigPlugin();
