const { EmbedBuilder } = require('discord.js');
class InventoryPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const items = await pluginCtx.inventory.getAllItems();
            
            const embed = new EmbedBuilder()
                .setTitle('🎒 Inventory Engine')
                .addFields(
                    { name: '📦 Registered Items', value: `${items ? Object.keys(items).length : 0}`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Active', inline: true }
                )
                .setColor('#2ECC71');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(`Engine failed: ${e.message}`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new InventoryPage();