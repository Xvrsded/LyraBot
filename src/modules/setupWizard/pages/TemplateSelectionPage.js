const templateRegistry = require('../registry/templateRegistry');

class TemplateSelectionPage {
    render() {
        const templates = templateRegistry.getAll();
        const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
        const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ui:setup:action:selectedTemplate')
                .setPlaceholder('Select a template...')
                .addOptions(templates.map(t => ({ label: t.name, value: t.id })))
        );

        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ui:setup:nav:index')
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ui:setup:nav:preview')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
        );

        return {
            content: '**Select a Template**',
            components: [selectRow, buttonRow]
        };
    }
}
module.exports = new TemplateSelectionPage();
