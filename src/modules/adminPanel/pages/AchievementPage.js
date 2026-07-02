const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
class AchievementPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const achievementRegistry = require('../../../services/achievementRegistry');
            const achievements = achievementRegistry.getAllAchievements();
            const embed = new EmbedBuilder()
                .setTitle('🏆 Achievement Statistics')
                .addFields(
                    { name: '🏅 Total Achievements', value: `${achievements ? achievements.length : 0}`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Active', inline: true }
                )
                .setColor('#F39C12');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(`Engine failed: ${e.message}`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new AchievementPage();