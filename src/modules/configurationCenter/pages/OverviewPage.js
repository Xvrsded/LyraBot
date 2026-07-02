const componentManager = require('../../ui/services/componentManager');
const { EmbedBuilder } = require('discord.js');

class OverviewPage {
    render(context) {
        const guildId = context.guildId || 'unknown';
        const guildName = context.guild ? context.guild.name : 'Server';

        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Configuration Center - ${guildName}`)
            .setDescription('Selamat datang di Pusat Konfigurasi. Silakan pilih modul yang ingin Anda atur.')
            .addFields(
                { name: '📡 Pipeline Status', value: '🟢 Aktif', inline: true },
                { name: '🩺 Health Status', value: '🟢 Sehat', inline: true },
                { name: '🤖 Automation', value: '🔴 Offline', inline: true }
            )
            .setColor('#2b2d31')
            .setFooter({ text: 'Enterprise Config Manager' });

        const btnOwO = componentManager.createButton({
            id: 'ui:owo_config:nav:index', // Use nav for internal panel navigation
            label: 'OwO Integration',
            emoji: '🐶',
            style: 1
        });

        const btnLeveling = componentManager.createButton({
            id: 'ui:leveling_config:nav:index', // Use nav for internal panel navigation
            label: 'Leveling',
            emoji: '⭐',
            style: 1
        });

        const actionRow = componentManager.createActionRow([btnOwO, btnLeveling]);

        return {
            embeds: [embed],
            components: [actionRow],
            ephemeral: true
        };
    }
}
module.exports = new OverviewPage();
