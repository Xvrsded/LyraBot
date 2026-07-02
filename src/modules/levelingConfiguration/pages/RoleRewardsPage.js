const owoConfigBreadcrumbs = require('../../owoConfiguration/components/configBreadcrumbs');
const owoConfigPagination = require('../../owoConfiguration/components/configPagination');
const levelingConfigManager = require('../services/levelingConfigManager');

class RoleRewardsPage {
    async render(guildId, pageIndex = 0) {
        const breadcrumb = owoConfigBreadcrumbs.render(['Leveling Overview', 'Role Rewards']);
        const rewards = await levelingConfigManager.getConfig(guildId, 'roleRewards') || [
            { level: 5, roleId: '111', enabled: true },
            { level: 10, roleId: '222', enabled: true },
            { level: 20, roleId: '333', enabled: true }
        ];

        const paginated = owoConfigPagination.render(rewards, pageIndex, 4);

        let content = `${breadcrumb}**Role Rewards**\n${paginated.text}\n\n`;
        const components = [];

        for (const reward of paginated.items) {
            content += `**Level ${reward.level}** -> Role <@&${reward.roleId}>\nStatus: ${reward.enabled ? '✅' : '❌'}\n\n`;
            components.push({
                type: 'select',
                id: `lvl_cfg_role_action_${reward.level}`,
                placeholder: `Manage Level ${reward.level}...`,
                options: [
                    { label: 'Edit Role', value: 'edit' },
                    { label: 'Toggle Status', value: 'toggle' },
                    { label: 'Delete', value: 'delete' }
                ]
            });
        }

        components.push(...paginated.components);
        components.push({ type: 'button', label: 'Add New Reward', id: 'lvl_cfg_role_add', style: 'success' });
        components.push({ type: 'button', label: 'Back', id: 'lvl_cfg_overview', style: 'secondary' });

        return { content, components };
    }
}
module.exports = new RoleRewardsPage();
