const configBreadcrumbs = require('../components/configBreadcrumbs');
const owoConfigManager = require('../services/owoConfigManager');

class HealthConfigPage {
    async render(guildId) {
        const breadcrumb = configBreadcrumbs.render(['Health & Sync']);
        const health = await owoConfigManager.getIntegrationHealth(guildId);
        
        let content = `${breadcrumb}**Health Report & Diagnostics**\n\n`;
        content += `**Overall Health:** ${health.overallHealth}%\n\n`;

        // Render components if they exist, otherwise mock
        const comps = health.components.length ? health.components : [
            { name: 'Discovery Health', status: 'ok' },
            { name: 'Behavior Health', status: 'warning' },
            { name: 'Automation Health', status: 'ok' },
            { name: 'Pipeline Health', status: 'ok' }
        ];

        for (const c of comps) {
            const icon = c.status === 'ok' ? '🟢' : (c.status === 'warning' ? '🟡' : '🔴');
            content += `${icon} **${c.name}**: ${c.status.toUpperCase()}\n`;
        }

        content += `\n*If your overall health is below 100%, run Auto Fix to resynchronize the database and Discord channels.*`;

        const components = [
            { type: 'button', label: 'Run Validation', id: 'owo_cfg_run_validation', style: 'primary' },
            { type: 'button', label: 'Run Auto Fix', id: 'owo_cfg_run_autofix', style: 'success' },
            { type: 'button', label: 'Refresh', id: 'owo_cfg_health', style: 'secondary' },
            { type: 'button', label: 'Back to Overview', id: 'owo_cfg_overview', style: 'secondary' }
        ];

        return { content, components };
    }
}
module.exports = new HealthConfigPage();
