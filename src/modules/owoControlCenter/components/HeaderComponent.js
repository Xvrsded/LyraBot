const { EmbedBuilder } = require('discord.js');
const automationManager = require('../../owoAutomation/services/automationManager');
const configService = require('../../../services/configService');

class HeaderComponent {
    async render(guildId, title) {
        const health = automationManager ? await automationManager.getHealth() : 100;
        const color = health >= 90 ? '#00FF00' : health >= 70 ? '#FFA500' : '#FF0000';
        const template = await configService.get(guildId, 'setup.template') || 'OwO';

        return new EmbedBuilder()
            .setTitle(`❄ WinterBot Control Center: ${title}`)
            .setDescription(`**Template:** ${template} | **Health:** ${health}% | **Status:** 🟢 Online`)
            .setColor(color);
    }
}

module.exports = new HeaderComponent();
