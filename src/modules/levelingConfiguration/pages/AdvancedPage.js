const owoConfigBreadcrumbs = require('../../owoConfiguration/components/configBreadcrumbs');
const levelingConfigManager = require('../services/levelingConfigManager');

class AdvancedPage {
    async render(guildId) {
        const breadcrumb = owoConfigBreadcrumbs.render(['Leveling Overview', 'Advanced Settings']);
        const getVal = async (key, def) => (await levelingConfigManager.getConfig(guildId, `advanced.${key}`)) ?? def;

        const components = [
            { type: 'toggle', label: 'Enable Leveling', value: await getVal('enableLeveling', true), id: 'lvl_cfg_adv_leveling' },
            { type: 'toggle', label: 'Enable Progression', value: await getVal('enableProgression', true), id: 'lvl_cfg_adv_progression' },
            { type: 'toggle', label: 'Enable Role Reward', value: await getVal('enableRoleReward', true), id: 'lvl_cfg_adv_roles' },
            { type: 'button', label: 'Reset XP', id: 'lvl_cfg_adv_reset_xp', style: 'danger' },
            { type: 'button', label: 'Factory Reset', id: 'lvl_cfg_adv_reset_factory', style: 'danger' },
            { type: 'button', label: 'Back', id: 'lvl_cfg_overview', style: 'secondary' }
        ];

        return {
            content: `${breadcrumb}**Advanced Settings**\nMaster toggles and data reset functionality. Use reset buttons with caution!`,
            components
        };
    }
}
module.exports = new AdvancedPage();
