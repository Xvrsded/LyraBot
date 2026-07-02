const configBreadcrumbs = require('../components/configBreadcrumbs');
const owoConfigManager = require('../services/owoConfigManager');

class GeneralConfigPage {
    async render(guildId) {
        const breadcrumb = configBreadcrumbs.render(['General']);
        
        // Mock default toggles (in production this comes from DB)
        const getVal = async (key) => (await owoConfigManager.getConfig(guildId, key)) !== false;

        const components = [
            { type: 'toggle', label: 'Enable OwO Integration', value: await getVal('integrationEnabled'), id: 'owo_cfg_toggle_integration' },
            { type: 'toggle', label: 'Enable Automation', value: await getVal('automationEnabled'), id: 'owo_cfg_toggle_automation' },
            { type: 'toggle', label: 'Enable Parser', value: await getVal('parserEnabled'), id: 'owo_cfg_toggle_parser' },
            { type: 'toggle', label: 'Enable Reminder', value: await getVal('reminderEnabled'), id: 'owo_cfg_toggle_reminder' },
            { type: 'toggle', label: 'Enable Dashboard', value: await getVal('dashboardEnabled'), id: 'owo_cfg_toggle_dashboard' },
            { type: 'toggle', label: 'Enable Economy Sync', value: await getVal('economySync'), id: 'owo_cfg_toggle_economy' },
            { type: 'button', label: 'Back to Overview', id: 'owo_cfg_overview', style: 'secondary' }
        ];

        return {
            content: `${breadcrumb}**General Settings**\nToggle core features on or off. Changes save automatically.`,
            components
        };
    }
}
module.exports = new GeneralConfigPage();
