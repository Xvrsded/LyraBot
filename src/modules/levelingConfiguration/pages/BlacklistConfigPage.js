const owoConfigBreadcrumbs = require('../../owoConfiguration/components/configBreadcrumbs');
const owoConfigPagination = require('../../owoConfiguration/components/configPagination');
const levelingConfigManager = require('../services/levelingConfigManager');

class BlacklistConfigPage {
    async render(guildId, pageIndex = 0) {
        const breadcrumb = owoConfigBreadcrumbs.render(['Leveling Overview', 'Blacklists']);
        const blacklists = await levelingConfigManager.getConfig(guildId, 'blacklist.items') || [
            { id: '111', type: 'channel' },
            { id: '222', type: 'role' },
            { id: '333', type: 'category' }
        ];

        const paginated = owoConfigPagination.render(blacklists, pageIndex, 4);

        let content = `${breadcrumb}**Blacklist / Whitelist Configuration**\nExcluded channels, roles, and categories will not grant XP.\n\n${paginated.text}\n\n`;
        const components = [];

        for (const item of paginated.items) {
            content += `**Type:** ${item.type.toUpperCase()} | **ID:** ${item.id}\n`;
            components.push({
                type: 'button',
                label: `Remove ${item.type}`,
                id: `lvl_cfg_bl_remove_${item.id}`,
                style: 'danger'
            });
        }
        content += '\n';

        components.push(...paginated.components);
        components.push({ type: 'button', label: 'Add to Blacklist', id: 'lvl_cfg_bl_add', style: 'primary' });
        components.push({ type: 'button', label: 'Back', id: 'lvl_cfg_overview', style: 'secondary' });

        return { content, components };
    }
}
module.exports = new BlacklistConfigPage();
