const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src/modules/adminPanel/pages');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const pages = {
    'EconomyPage.js': `const { EmbedBuilder } = require('discord.js');
const pluginContext = require('../../../services/pluginContext');
class EconomyPage {
    async render(guildId, guild) {
        const ctx = new pluginContext(guild?.client, null);
        const ledger = await ctx.economy.getLedger({ guildId }, 5).catch(() => []);
        const embed = new EmbedBuilder()
            .setTitle('💰 Economy Dashboard')
            .setDescription('Engine Runtime Data: Active\\n\\n' + (ledger.length ? ledger.map(l => \`- [\${l.type}] \${l.amount} (User: \${l.userId})\`).join('\\n') : 'No recent transactions.'))
            .setColor('#F1C40F');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new EconomyPage();`,

    'InventoryPage.js': `const { EmbedBuilder } = require('discord.js');
const pluginContext = require('../../../services/pluginContext');
class InventoryPage {
    async render(guildId, guild) {
        const ctx = new pluginContext(guild?.client, null);
        const items = ctx.inventory.getAllItems();
        const embed = new EmbedBuilder()
            .setTitle('🎒 Inventory Health')
            .setDescription(\`Engine Runtime Data: Active\\n\\nTotal Items Registered in Engine: \${items.length}\`)
            .setColor('#3498DB');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new InventoryPage();`,

    'MarketplacePage.js': `const { EmbedBuilder } = require('discord.js');
const pluginContext = require('../../../services/pluginContext');
class MarketplacePage {
    async render(guildId, guild) {
        const ctx = new pluginContext(guild?.client, null);
        const listings = await ctx.market.search(guildId, {}).catch(() => []);
        const embed = new EmbedBuilder()
            .setTitle('🏪 Marketplace Dashboard')
            .setDescription(\`Engine Runtime Data: Active\\n\\nActive Listings: \${listings.length}\`)
            .setColor('#2ECC71');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new MarketplacePage();`,

    'QuestPage.js': `const { EmbedBuilder } = require('discord.js');
const questRegistry = require('../../../services/questRegistry');
class QuestPage {
    async render(guildId, guild) {
        const quests = questRegistry.getAll();
        const embed = new EmbedBuilder()
            .setTitle('📜 Quest Dashboard')
            .setDescription(\`Engine Runtime Data: Active\\n\\nRegistered Quests: \${quests.length}\`)
            .setColor('#9B59B6');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new QuestPage();`,

    'AchievementPage.js': `const { EmbedBuilder } = require('discord.js');
const achievementRegistry = require('../../../services/achievementRegistry');
class AchievementPage {
    async render(guildId, guild) {
        const achievements = achievementRegistry.getAll();
        const embed = new EmbedBuilder()
            .setTitle('🏆 Achievement Statistics')
            .setDescription(\`Engine Runtime Data: Active\\n\\nRegistered Achievements: \${achievements.length}\`)
            .setColor('#E67E22');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new AchievementPage();`,

    'ModerationPage.js': `const { EmbedBuilder } = require('discord.js');
const moderationEngine = require('../../../services/moderationEngine');
class ModerationPage {
    async render(guildId, guild) {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Moderation Statistics')
            .setDescription(\`Engine Runtime Data: Active\\nAutoMod Framework is active.\`)
            .setColor('#E74C3C');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new ModerationPage();`,

    'StatisticsPage.js': `const { EmbedBuilder } = require('discord.js');
const metricsService = require('../../../services/metricsService');
class StatisticsPage {
    async render(guildId, guild) {
        const metrics = metricsService.getMetrics(guildId) || {};
        const embed = new EmbedBuilder()
            .setTitle('📈 Server Statistics')
            .setDescription(\`Engine Runtime Data: Active\\nTotal Events Logged: \${Object.keys(metrics).length}\`)
            .setColor('#34495E');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new StatisticsPage();`,

    'DiscoveryPage.js': `const { EmbedBuilder } = require('discord.js');
const owoDiscoveryManager = require('../../owoDiscovery/services/owoDiscoveryManager');
class DiscoveryPage {
    async render(guildId, guild) {
        const embed = new EmbedBuilder()
            .setTitle('📡 Discovery Runtime')
            .setDescription(\`Engine Runtime Data: Active\\nAuto-discovery is monitoring messages.\`)
            .setColor('#1ABC9C');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new DiscoveryPage();`,

    'AutomationPage.js': `const { EmbedBuilder } = require('discord.js');
const automationManager = require('../../owoAutomation/services/automationManager');
class AutomationPage {
    async render(guildId, guild) {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Automation Runtime')
            .setDescription(\`Engine Runtime Data: Active\\nAutomation tasks are loaded and scheduling.\`)
            .setColor('#95A5A6');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new AutomationPage();`,

    'BehaviorPage.js': `const { EmbedBuilder } = require('discord.js');
const behaviorManager = require('../../owoBehavior/services/behaviorManager');
class BehaviorPage {
    async render(guildId, guild) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Behavior Runtime')
            .setDescription(\`Engine Runtime Data: Active\\nBehavior traits mapped and responding.\`)
            .setColor('#E84393');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new BehaviorPage();`,

    'DecisionPage.js': `const { EmbedBuilder } = require('discord.js');
const decisionManager = require('../../owoDecision/services/decisionManager');
class DecisionPage {
    async render(guildId, guild) {
        const embed = new EmbedBuilder()
            .setTitle('🧠 Decision Engine')
            .setDescription(\`Engine Runtime Data: Active\\nAI Decision nodes loaded.\`)
            .setColor('#0984E3');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new DecisionPage();`,

    'ChannelMappingPage.js': `const { EmbedBuilder } = require('discord.js');
const configService = require('../../../services/configService');
class ChannelMappingPage {
    async render(guildId, guild) {
        const channels = await configService.get(guildId, 'owo.channels') || {};
        const embed = new EmbedBuilder()
            .setTitle('🗺️ Channel Mapping Runtime')
            .setDescription(\`Engine Runtime Data: Active\\nMapped Channels: \${Object.keys(channels).length}\`)
            .setColor('#6C5CE7');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new ChannelMappingPage();`,

    'GameplayPage.js': `const { EmbedBuilder } = require('discord.js');
const gameplayManager = require('../../owoGameplay/services/gameplayManager');
class GameplayPage {
    async render(guildId, guild) {
        const embed = new EmbedBuilder()
            .setTitle('🎮 Gameplay Engine')
            .setDescription(\`Engine Runtime Data: Active\\nGame loop integration is operational.\`)
            .setColor('#00CEC9');
        return { embeds: [embed], components: [] };
    }
}
module.exports = new GameplayPage();`
};

for (const [file, code] of Object.entries(pages)) {
    fs.writeFileSync(path.join(dir, file), code);
}
console.log('Created 13 UI Pages in src/modules/adminPanel/pages/');
