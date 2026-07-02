const { EmbedBuilder } = require('discord.js');

class FooterComponent {
    render(currentPage) {
        const now = new Date().toLocaleString();
        return new EmbedBuilder()
            .setColor('#2F3136')
            .setFooter({ text: `Page: ${currentPage} | Updated: ${now} | WinterBot Enterprise v1.0.0` });
    }
}

module.exports = new FooterComponent();
