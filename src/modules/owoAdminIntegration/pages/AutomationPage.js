const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

class AutomationPage {
    render(guildId, data) {
        const { stats } = data;

        const embed = new EmbedBuilder()
            .setTitle('OwO Automation Orchestrator')
            .setDescription('View the statistics of automated background workflows.')
            .setColor('#9B59B6');

        if (stats && stats.length > 0) {
            let str = '';
            for (const s of stats.slice(0, 10)) { // Top 10
                str += `**${s.module}** (${s.activity}):\nExecs: ${s.executions} | Success: ${s.successes} | Fails: ${s.failures}\n`;
            }
            embed.addFields({ name: 'Workflow Metrics', value: str.substring(0, 1024) });
        } else {
            embed.addFields({ name: 'Workflow Metrics', value: 'No data yet.' });
        }

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

module.exports = new AutomationPage();
