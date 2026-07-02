const templateRegistry = require('../registry/templateRegistry');

class PreviewPage {
    render(state) {
        const template = templateRegistry.getTemplate(state.selectedTemplate);
        if (!template) return { content: 'No template selected.' };

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ui:setup:nav:template')
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ui:setup:nav:configuration')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
        );

        return {
            content: `**Preview: ${template.name}**\nCategories: ${template.categories}\nChannels: ${template.channels}\nRoles: ${template.roles}\nModules: ${template.modules.join(', ')}`,
            components: [row]
        };
    }
}
module.exports = new PreviewPage();
