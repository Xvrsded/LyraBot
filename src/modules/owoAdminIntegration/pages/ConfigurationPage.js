const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

class ConfigurationPage {
    render(guildId, data) {
        const embed = new EmbedBuilder()
            .setTitle('Global Configuration')
            .setDescription('Manage your server\'s global settings here.')
            .setColor('#F1C40F')
            .addFields(
                { name: 'Feature toggles', value: 'Coming Soon' }
            );

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('admin_panel_nav')
                .setPlaceholder('Navigate to...')
                .addOptions([
                    { label: 'Overview', value: 'overview', description: 'Main Dashboard', emoji: '🏠' },
                    { label: 'OwO Behavior', value: 'behavior', description: 'Channel Mappings', emoji: '🦝' },
                    { label: 'Automation', value: 'automation', description: 'Workflow Orchestrator', emoji: '⚙️' },
                    { label: 'Configuration', value: 'configuration', description: 'Global Configs', emoji: '🛠️' }
                ])
        );

        return { embeds: [embed], components: [menu] };
    }
}

module.exports = new ConfigurationPage();
