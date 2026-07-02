const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

class BehaviorPage {
    render(guildId, data) {
        const { behaviorMap, missingBehaviors } = data;

        const embed = new EmbedBuilder()
            .setTitle('OwO Behavior Mapping')
            .setDescription('View how raw Discord channels map to game behaviors.')
            .setColor('#3498DB');

        let mappingsStr = '';
        if (behaviorMap && behaviorMap.length > 0) {
            mappingsStr = behaviorMap.map(b => `**${b.behavior}**: <#${b.channelId}>`).join('\n');
            embed.addFields({ name: 'Mapped Channels', value: mappingsStr.substring(0, 1024) });
        } else {
            embed.addFields({ name: 'Mapped Channels', value: 'None' });
        }

        if (missingBehaviors && missingBehaviors.length > 0) {
            embed.addFields({ name: 'Missing Behaviors', value: missingBehaviors.join(', ').substring(0, 1024) });
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

module.exports = new BehaviorPage();
