const { EmbedBuilder } = require('discord.js');
class DecisionPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const decisionEngine = require('../../owoDecision/services/decisionEngine');
            const models = decisionEngine.getModels ? decisionEngine.getModels() : [];
            const ruleCount = decisionEngine.rules.length;
            
            const embed = new EmbedBuilder()
                .setTitle('🧠 Decision Engine')
                .addFields(
                    { name: '⚖️ Rules', value: `${ruleCount} Active Rules`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Active', inline: true }
                )
                .setColor('#2980B9');
            return { embeds: [embed], components: [] };
        } catch (e) {
            pluginCtx.audit.error(e.message);
            const embed = new EmbedBuilder().setTitle('Error').setDescription(`Engine failed: ${e.message}`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new DecisionPage();