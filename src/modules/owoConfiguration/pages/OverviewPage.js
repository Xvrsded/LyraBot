const owoConfigManager = require('../services/owoConfigManager');

class OverviewPage {
    async render(guildId) {
        const health = await owoConfigManager.getIntegrationHealth(guildId);
        const activeTemplate = await owoConfigManager.getConfig(guildId, 'activeTemplate') || 'official_owo';
        const isParserEnabled = await owoConfigManager.getConfig(guildId, 'parserEnabled') || false;
        
        let content = `**OwO Enterprise Configuration**\n\n`;
        content += `**Status Integrasi:** ${health.overallHealth === 100 ? '🟢 Perfect' : (health.overallHealth > 70 ? '🟡 Warning' : '🔴 Critical')}\n`;
        content += `**Overall Health:** ${health.overallHealth}%\n`;
        content += `**Active Template:** ${activeTemplate}\n`;
        content += `**Parser Status:** ${isParserEnabled ? '✅ Active' : '❌ Disabled'}\n`;
        content += `**Last Sync:** ${new Date().toLocaleString()}\n`;

        return {
            content,
            components: [
                { type: 'button', label: 'General', id: 'owo_cfg_general', style: 'primary' },
                { type: 'button', label: 'Channels', id: 'owo_cfg_channels', style: 'primary' },
                { type: 'button', label: 'Parsers', id: 'owo_cfg_parsers', style: 'primary' },
                { type: 'button', label: 'Health', id: 'owo_cfg_health', style: 'secondary' }
            ]
        };
    }
}
module.exports = new OverviewPage();
