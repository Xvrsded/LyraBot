const { EmbedBuilder } = require('discord.js');
class MarketplacePage {
    async render(guildId, guild, pluginCtx) {
        try {
            const listings = await pluginCtx.market.browse(guildId, {});
            const embed = new EmbedBuilder()
                .setTitle('🏪 Marketplace Dashboard')
                .addFields(
                    { name: '📜 Active Listings', value: `${listings ? listings.length : 0}`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Active', inline: true }
                )
                .setColor('#E67E22');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(`Engine failed: ${e.message}`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new MarketplacePage();