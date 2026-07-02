class WelcomePage {
    render(validationStatus) {
        let content = '**Welcome to WinterBot Setup Wizard**\n';
        if (validationStatus.valid) {
            content += 'All permissions look good!';
        } else {
            content += `Missing: ${validationStatus.missing.join(', ')}`;
        }
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ui:setup:nav:template')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!validationStatus.valid),
            new ButtonBuilder()
                .setCustomId('ui:setup:close')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        return {
            content,
            components: [row]
        };
    }
}
module.exports = new WelcomePage();
