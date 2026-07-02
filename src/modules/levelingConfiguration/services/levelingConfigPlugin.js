const OverviewPage = require('../pages/OverviewPage');
const XpConfigPage = require('../pages/XpConfigPage');
const FormulaConfigPage = require('../pages/FormulaConfigPage');
const RoleRewardsPage = require('../pages/RoleRewardsPage');
const AnnouncementPage = require('../pages/AnnouncementPage');
const LeaderboardConfigPage = require('../pages/LeaderboardConfigPage');
const BlacklistConfigPage = require('../pages/BlacklistConfigPage');
const AdvancedPage = require('../pages/AdvancedPage');

class LevelingConfigPlugin {
    getPluginApi() {
        return {
            renderOverview: async (guildId) => await OverviewPage.render(guildId),
            renderXpConfig: async (guildId) => await XpConfigPage.render(guildId),
            renderFormulaConfig: async (guildId) => await FormulaConfigPage.render(guildId),
            renderRoleRewards: async (guildId, pageIndex) => await RoleRewardsPage.render(guildId, pageIndex),
            renderAnnouncement: async (guildId) => await AnnouncementPage.render(guildId),
            renderLeaderboard: async (guildId) => await LeaderboardConfigPage.render(guildId),
            renderBlacklist: async (guildId, pageIndex) => await BlacklistConfigPage.render(guildId, pageIndex),
            renderAdvanced: async (guildId) => await AdvancedPage.render(guildId)
        };
    }
}

module.exports = new LevelingConfigPlugin();
