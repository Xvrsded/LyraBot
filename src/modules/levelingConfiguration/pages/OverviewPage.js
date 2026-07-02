const levelingConfigManager = require('../services/levelingConfigManager');
const owoConfigBreadcrumbs = require('../../owoConfiguration/components/configBreadcrumbs');

class OverviewPage {
    async render(guildId) {
        // Fetch real data from Progression Engine / DB in production
        const totalXp = await levelingConfigManager.getConfig(guildId, 'stats.totalXpToday') || 0;
        const totalLevelUp = await levelingConfigManager.getConfig(guildId, 'stats.totalLevelUp') || 0;
        const highestLevel = await levelingConfigManager.getConfig(guildId, 'stats.highestLevel') || 1;
        const formula = await levelingConfigManager.getConfig(guildId, 'formula.type') || 'Linear';
        const multiplier = await levelingConfigManager.getConfig(guildId, 'multiplier.active') || 1.0;
        
        const isEnabled = await levelingConfigManager.getConfig(guildId, 'advanced.enableLeveling') !== false;

        let content = `${owoConfigBreadcrumbs.render(['Leveling Overview'])}`;
        content += `**Leveling System Status:** ${isEnabled ? '✅ Active' : '❌ Disabled'}\n\n`;
        content += `**Total XP Today:** ${totalXp}\n`;
        content += `**Total Level Up:** ${totalLevelUp}\n`;
        content += `**Highest Level:** ${highestLevel}\n`;
        content += `**XP Formula:** ${formula}\n`;
        content += `**Active Multiplier:** ${multiplier}x\n`;
        content += `**Last Configuration Update:** ${new Date().toLocaleString()}\n`;

        return {
            content,
            components: [
                { type: 'button', label: 'XP Settings', id: 'lvl_cfg_xp', style: 'primary' },
                { type: 'button', label: 'Formula', id: 'lvl_cfg_formula', style: 'primary' },
                { type: 'button', label: 'Role Rewards', id: 'lvl_cfg_roles', style: 'primary' },
                { type: 'button', label: 'Announcement', id: 'lvl_cfg_announce', style: 'primary' },
                { type: 'button', label: 'Leaderboard', id: 'lvl_cfg_leaderboard', style: 'secondary' },
                { type: 'button', label: 'Blacklist', id: 'lvl_cfg_blacklist', style: 'secondary' },
                { type: 'button', label: 'Advanced', id: 'lvl_cfg_advanced', style: 'danger' }
            ]
        };
    }
}
module.exports = new OverviewPage();
