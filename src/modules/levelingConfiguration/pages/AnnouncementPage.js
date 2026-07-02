const owoConfigBreadcrumbs = require('../../owoConfiguration/components/configBreadcrumbs');
const levelingConfigManager = require('../services/levelingConfigManager');

class AnnouncementPage {
    async render(guildId) {
        const breadcrumb = owoConfigBreadcrumbs.render(['Leveling Overview', 'Announcement']);
        const getVal = async (key, def) => (await levelingConfigManager.getConfig(guildId, `announcement.${key}`)) ?? def;

        const components = [
            { type: 'button', label: 'Set Announcement Channel', id: 'lvl_cfg_announce_chan' },
            { type: 'button', label: 'Edit Custom Message', id: 'lvl_cfg_announce_msg' },
            { type: 'toggle', label: 'Mention User', value: await getVal('mentionUser', true), id: 'lvl_cfg_announce_mention' },
            { type: 'toggle', label: 'Show Rank', value: await getVal('showRank', true), id: 'lvl_cfg_announce_rank' },
            { type: 'toggle', label: 'Show XP', value: await getVal('showXp', true), id: 'lvl_cfg_announce_xp' },
            { type: 'button', label: 'Preview Message', id: 'lvl_cfg_announce_preview', style: 'success' },
            { type: 'button', label: 'Back', id: 'lvl_cfg_overview', style: 'secondary' }
        ];

        return {
            content: `${breadcrumb}**Announcement Configuration**\nConfigure where and how level up messages are sent.`,
            components
        };
    }
}
module.exports = new AnnouncementPage();
