const configBreadcrumbs = require('../components/configBreadcrumbs');
const configPagination = require('../components/configPagination');
const owoConfigManager = require('../services/owoConfigManager');

class ChannelConfigPage {
    async render(guildId, pageIndex = 0) {
        const breadcrumb = configBreadcrumbs.render(['Channels']);
        
        // Mock channel map. In prod, fetch from owoConfigManager config 'mappedChannels'
        const rawChannels = await owoConfigManager.getConfig(guildId, 'mappedChannels') || [
            { name: 'Hunt Channel', id: '111', enabled: true },
            { name: 'Battle Channel', id: '222', enabled: true },
            { name: 'Quest Channel', id: '333', enabled: true },
            { name: 'Marketplace Channel', id: '444', enabled: false },
            { name: 'Inventory Channel', id: '555', enabled: true },
            { name: 'Daily Channel', id: '666', enabled: true },
            { name: 'Casino Channel', id: '777', enabled: false }
        ];

        const paginated = configPagination.render(rawChannels, pageIndex, 4);
        
        let content = `${breadcrumb}**Channel Configuration**\n${paginated.text}\n\n`;
        const components = [];

        for (const ch of paginated.items) {
            content += `**${ch.name}**\nStatus: ${ch.enabled ? '✅ Enabled' : '❌ Disabled'}\nMapped ID: <#${ch.id}>\n\n`;
            
            // Render specific components for each item using Discord conventions
            // (Mocking as a select menu or individual buttons depending on the UI builder)
            components.push({
                type: 'select',
                id: `owo_cfg_chan_action_${ch.id}`,
                placeholder: `Manage ${ch.name}...`,
                options: [
                    { label: 'Enable', value: 'enable' },
                    { label: 'Disable', value: 'disable' },
                    { label: 'Remap / Auto Detect', value: 'remap' }
                ]
            });
        }

        // Add pagination controls
        components.push(...paginated.components);
        components.push({ type: 'button', label: 'Back to Overview', id: 'owo_cfg_overview', style: 'secondary' });

        return { content, components };
    }
}
module.exports = new ChannelConfigPage();
