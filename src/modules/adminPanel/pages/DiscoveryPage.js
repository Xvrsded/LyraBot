const { EmbedBuilder } = require('discord.js');
class DiscoveryPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const { healthScore, missing } = await pluginCtx.owoDiscovery.scan(guild);
            const missingText = missing && missing.length > 0 ? missing.join(', ') : 'None';
            const embed = new EmbedBuilder()
                .setTitle('📡 Discovery Runtime')
                .addFields(
                    { name: '🔍 Discovery Health Score', value: `${healthScore}/100`, inline: true },
                    { name: '⚠️ Missing Entities', value: missingText, inline: true }
                )
                .setColor(healthScore === 100 ? '#1ABC9C' : '#E74C3C');
            return { embeds: [embed], components: [] };
        } catch (e) {
            pluginCtx.audit.error(e.message);
            const embed = new EmbedBuilder().setTitle('Error').setDescription(`Engine failed: ${e.message}`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new DiscoveryPage();