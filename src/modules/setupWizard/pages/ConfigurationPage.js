class ConfigurationPage {
    render(state) {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
        const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ui:setup:action:toggle_modules')
                .setPlaceholder('Select modules to enable...')
                .setMinValues(0)
                .setMaxValues(2)
                .addOptions([
                    { label: 'Enable Quest Engine', value: 'quest' },
                    { label: 'Enable Leveling Engine', value: 'leveling' }
                ])
        );

        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ui:setup:nav:preview')
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ui:setup:action:start_install')
                .setLabel('Install')
                .setStyle(ButtonStyle.Success)
        );

        return {
            content: '**Configuration**\nTweak which modules to enable before installing.',
            components: [selectRow, buttonRow]
        };
    }
}
module.exports = new ConfigurationPage();
