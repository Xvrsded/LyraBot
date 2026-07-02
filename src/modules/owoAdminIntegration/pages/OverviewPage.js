const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

class OverviewPage {
    render(guildId, data) {
        const { healthScore, activeWorkflows, failedWorkflows } = data;

        const embed = new EmbedBuilder()
            .setTitle('Enterprise OwO Dashboard - Overview')
            .setDescription('Welcome to the Central Administration Panel for WinterBot.')
            .setColor(healthScore === 100 ? '#00FF00' : '#FFA500')
            .addFields(
                { name: 'System Health', value: `${healthScore}%`, inline: true },
                { name: 'Active Workflows', value: `${activeWorkflows}`, inline: true },
                { name: 'Failed Workflows', value: `${failedWorkflows}`, inline: true }
            )
            .setFooter({ text: 'Last Updated' })
            .setTimestamp();

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

        const actions = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('panel_refresh').setLabel('Force Refresh').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('panel_restart').setLabel('Restart Engine').setStyle(ButtonStyle.Danger)
        );

        return { embeds: [embed], components: [menu, actions] };
    }
}

module.exports = new OverviewPage();
