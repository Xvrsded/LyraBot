const { EmbedBuilder } = require('discord.js');
class QuestPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const questRegistry = require('../../../services/questRegistry');
            const quests = questRegistry.getAllQuests();
            const embed = new EmbedBuilder()
                .setTitle('📜 Quest Dashboard')
                .addFields(
                    { name: '🎯 Active Quests', value: `${quests ? quests.length : 0}`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Active', inline: true }
                )
                .setColor('#9B59B6');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(`Engine failed: ${e.message}`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new QuestPage();