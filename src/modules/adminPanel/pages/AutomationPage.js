const { EmbedBuilder } = require('discord.js');
class AutomationPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const stats = await pluginCtx.automation.getStatistics();
            const totalWorkflows = stats.length;
            const totalExecutions = stats.reduce((acc, stat) => acc + (stat.executions || 0), 0);
            
            const embed = new EmbedBuilder()
                .setTitle('⚙️ Automation Runtime')
                .addFields(
                    { name: '🔄 Workflows Aktif', value: `${totalWorkflows} modules`, inline: true },
                    { name: '⚡ Total Eksekusi', value: `${totalExecutions} times`, inline: true }
                )
                .setColor('#95A5A6');
            return { embeds: [embed], components: [] };
        } catch (e) {
            pluginCtx.audit.error(e.message);
            const embed = new EmbedBuilder().setTitle('Error').setDescription(`Engine failed: ${e.message}`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new AutomationPage();