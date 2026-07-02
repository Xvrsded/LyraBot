const { EmbedBuilder } = require('discord.js');
const pluginContext = require('../../../services/pluginContext');

class MasterOverviewPage {
    async render(guildId, guild) {
        // Fetch Live Runtime Data
        const channelsCount = guild ? guild.channels.cache.size : 0;
        const categoriesCount = guild ? guild.channels.cache.filter(c => c.type === 4).size : 0; // 4 is Category
        const rolesCount = guild ? guild.roles.cache.size : 0;
        const guildName = guild ? guild.name : 'Unknown Server';

        // Fetch Plugin Statuses
        // Since we are running in the context of the running bot, we can use pluginContext
        const integrationCtx = new pluginContext(guild.client, null).integration;
        const healthData = await integrationCtx.health(guildId);
        const overallHealth = healthData ? healthData.overallHealth : 0;
        const pipelineStatus = healthData ? (healthData.components.pipeline === 100 ? '🟢 Online' : '🟡 Degraded') : '🔴 Offline';
        const automationStatus = healthData ? (healthData.components.automation === 100 ? '🟢 Online' : '🔴 Offline') : '🔴 Offline';
        const discoveryStatus = healthData ? (healthData.components.discovery === 100 ? '🟢 Online' : '🔴 Offline') : '🔴 Offline';
        const behaviorStatus = healthData ? (healthData.components.behavior === 100 ? '🟢 Online' : '🔴 Offline') : '🔴 Offline';
        const parserStatus = healthData ? (healthData.components.parser === 100 ? '🟢 Online' : '🔴 Offline') : '🔴 Offline';
        
        // Configuration / Leveling Configs
        const configCtx = new pluginContext(guild.client, null).config;
        const owoEnabled = (await configCtx.get(guildId, 'owo.enabled')) ? '🟢 Active' : '🔴 Inactive';
        const levelingEnabled = (await configCtx.get(guildId, 'leveling.enabled')) ? '🟢 Active' : '🔴 Inactive';

        const embed = new EmbedBuilder()
            .setTitle(`📊 Master Enterprise Overview - ${guildName}`)
            .setDescription(`**WinterBot Enterprise Runtime Metrics**\nData ditarik secara real-time dari memori bot.`)
            .addFields(
                { name: '🏢 Server Metrics', value: `Channels: ${channelsCount}\nCategories: ${categoriesCount}\nRoles: ${rolesCount}`, inline: true },
                { name: '🩺 System Health', value: `Score: **${overallHealth}%**\nPipeline: ${pipelineStatus}\nAutomation: ${automationStatus}`, inline: true },
                { name: '⚙️ Engine Status', value: `Discovery: ${discoveryStatus}\nBehavior: ${behaviorStatus}\nParser: ${parserStatus}`, inline: true },
                { name: '⭐ Modules', value: `OwO: ${owoEnabled}\nLeveling: ${levelingEnabled}\nConfig: 🟢 Loaded\nDashboard: 🟢 Loaded`, inline: false }
            )
            .setColor('#5865F2')
            .setTimestamp();

        return {
            embeds: [embed],
            components: [] // The master panel uses action row buttons for navigation outside of the page itself
        };
    }
}

module.exports = new MasterOverviewPage();
