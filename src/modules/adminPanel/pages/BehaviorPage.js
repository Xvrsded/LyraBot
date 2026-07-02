const { EmbedBuilder } = require('discord.js');
class BehaviorPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const configCenterManager = require('../../configurationCenter/services/configCenterManager');
            const owoEnabled = await configCenterManager.get(guildId, 'owo.enabled');
            const config = await configCenterManager.get(guildId);
            
            let mappedCount = 0;
            if (config) {
                if (config.owo?.mainChannel) mappedCount++;
                if (config.owo?.questChannel) mappedCount++;
                if (config.roles?.admin) mappedCount++;
                if (config.roles?.verified) mappedCount++;
            }

            const embed = new EmbedBuilder()
                .setTitle('🤖 Behavior Runtime')
                .addFields(
                    { name: '🧠 Patterns', value: `${mappedCount} Mapped`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Active', inline: true }
                )
                .setColor('#8E44AD');
            return { embeds: [embed], components: [] };
        } catch (e) {
            pluginCtx.audit.error(e.message);
            const embed = new EmbedBuilder().setTitle('Error').setDescription(`Engine failed: ${e.message}`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new BehaviorPage();