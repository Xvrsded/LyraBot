const owoConfigBreadcrumbs = require('../../owoConfiguration/components/configBreadcrumbs');
const levelingConfigManager = require('../services/levelingConfigManager');

class XpConfigPage {
    async render(guildId) {
        const breadcrumb = owoConfigBreadcrumbs.render(['Leveling Overview', 'XP Configuration']);
        const getVal = async (key, def) => (await levelingConfigManager.getConfig(guildId, `xp.${key}`)) ?? def;

        const components = [
            { type: 'select', id: 'lvl_cfg_xp_activity', placeholder: 'Configure Activity XP Base...', options: [
                { label: 'Hunt', value: 'hunt', description: `Current: ${await getVal('hunt', 10)}` },
                { label: 'Battle', value: 'battle', description: `Current: ${await getVal('battle', 15)}` },
                { label: 'Daily', value: 'daily', description: `Current: ${await getVal('daily', 50)}` },
                { label: 'Quest', value: 'quest', description: `Current: ${await getVal('quest', 100)}` }
            ]},
            { type: 'button', label: 'Edit Global Multiplier', id: 'lvl_cfg_xp_mult' },
            { type: 'toggle', label: 'Double XP Weekend', value: await getVal('weekendDoubleXp', false), id: 'lvl_cfg_xp_weekend' },
            { type: 'button', label: 'Back', id: 'lvl_cfg_overview', style: 'secondary' }
        ];

        return {
            content: `${breadcrumb}**XP Configuration**\nSet base XP rewards for different activities and manage global multipliers.`,
            components
        };
    }
}
module.exports = new XpConfigPage();
