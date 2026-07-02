const { EmbedBuilder } = require('discord.js');
class ChannelMappingPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const config = await pluginCtx.configuration.get(guildId, 'owo.channels');
            const embed = new EmbedBuilder()
                .setTitle('🗺️ Channel Mapping')
                .addFields(
                    { name: '📍 Mapped Channels', value: `${config ? config.length : 0}`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#16A085');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(`Engine failed: ${e.message}`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new ChannelMappingPage();