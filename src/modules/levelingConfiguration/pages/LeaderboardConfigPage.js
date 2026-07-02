const owoConfigBreadcrumbs = require('../../owoConfiguration/components/configBreadcrumbs');
const levelingConfigManager = require('../services/levelingConfigManager');

class LeaderboardConfigPage {
    async render(guildId) {
        const breadcrumb = owoConfigBreadcrumbs.render(['Leveling Overview', 'Leaderboard Configuration']);
        const getVal = async (key, def) => (await levelingConfigManager.getConfig(guildId, `leaderboard.${key}`)) ?? def;

        const components = [
            { type: 'button', label: 'Set Max Entries', id: 'lvl_cfg_lb_entries' },
            { type: 'button', label: 'Set Refresh Interval', id: 'lvl_cfg_lb_interval' },
            { type: 'toggle', label: 'Enable Cache', value: await getVal('enableCache', true), id: 'lvl_cfg_lb_cache' },
            { type: 'toggle', label: 'Enable Weekly', value: await getVal('enableWeekly', true), id: 'lvl_cfg_lb_weekly' },
            { type: 'button', label: 'Manual Refresh Now', id: 'lvl_cfg_lb_refresh', style: 'success' },
            { type: 'button', label: 'Back', id: 'lvl_cfg_overview', style: 'secondary' }
        ];

        return {
            content: `${breadcrumb}**Leaderboard Configuration**\nConfigure how often the leaderboard updates and how many entries it shows.`,
            components
        };
    }
}
module.exports = new LeaderboardConfigPage();
