const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

class NavigationGrid {
    render() {
        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('admin_panel_nav')
                .setPlaceholder('Navigate Control Center...')
                .addOptions([
                    { label: 'Overview', value: 'overview', description: 'Main Dashboard', emoji: '🏠' },
                    { label: 'OwO Center', value: 'owo_center', description: 'Behavior Mappings', emoji: '🦝' },
                    { label: 'Quest Center', value: 'quest_center', description: 'Quest Engine', emoji: '🏆' },
                    { label: 'Level Center', value: 'level_center', description: 'Progression Engine', emoji: '⭐' },
                    { label: 'Economy Center', value: 'economy_center', description: 'Economy Stats', emoji: '💰' },
                    { label: 'Inventory Center', value: 'inventory_center', description: 'Inventory Limits', emoji: '🎒' },
                    { label: 'Marketplace Center', value: 'marketplace_center', description: 'Market Listings', emoji: '🏪' },
                    { label: 'Automation Center', value: 'automation_center', description: 'Workflow Orchestrator', emoji: '🤖' },
                    { label: 'Statistics', value: 'statistics', description: 'Server Analytics', emoji: '📊' },
                    { label: 'Configuration', value: 'configuration', description: 'Global Configs', emoji: '⚙️' },
                    { label: 'Moderation', value: 'moderation', description: 'Mod Actions', emoji: '🛡️' },
                    { label: 'Plugins', value: 'plugins', description: 'Plugin Manager', emoji: '🔌' },
                    { label: 'Audit', value: 'audit', description: 'Audit Logs', emoji: '📝' },
                    { label: 'System', value: 'system', description: 'System Health', emoji: '🖥️' }
                ])
        );
    }
}

module.exports = new NavigationGrid();
