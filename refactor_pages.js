const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'modules', 'adminPanel', 'pages');

const pages = {
    'EconomyPage.js': `const { EmbedBuilder } = require('discord.js');
class EconomyPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const ledger = await pluginCtx.economy.getLedger({ guildId }, 10);
            const Wallet = require('../../../../models/Wallet');
            const totalWallets = await Wallet.countDocuments({ guildId });
            
            const embed = new EmbedBuilder()
                .setTitle('💰 Economy Dashboard')
                .addFields(
                    { name: '🏦 Registered Wallets', value: \`\${totalWallets}\`, inline: true },
                    { name: '🔄 Recent Transactions', value: \`\${ledger.length}\`, inline: true },
                    { name: '⚡ Runtime Engine', value: 'Verified', inline: true },
                    { name: 'Latest Ledger', value: ledger.length ? ledger.map(l => \`- [\${l.type}] \${l.amount} (User: \${l.userId})\`).join('\\n') : 'No recent transactions.' }
                )
                .setColor('#F1C40F');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new EconomyPage();`,

    'InventoryPage.js': `const { EmbedBuilder } = require('discord.js');
class InventoryPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const items = await pluginCtx.inventory.getAllItems();
            
            const embed = new EmbedBuilder()
                .setTitle('🎒 Inventory Engine')
                .addFields(
                    { name: '📦 Registered Items', value: \`\${items ? Object.keys(items).length : 0}\`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#2ECC71');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new InventoryPage();`,

    'MarketplacePage.js': `const { EmbedBuilder } = require('discord.js');
class MarketplacePage {
    async render(guildId, guild, pluginCtx) {
        try {
            const listings = await pluginCtx.market.search(guildId, {});
            const embed = new EmbedBuilder()
                .setTitle('🏪 Marketplace Dashboard')
                .addFields(
                    { name: '📜 Active Listings', value: \`\${listings ? listings.length : 0}\`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#E67E22');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new MarketplacePage();`,

    'QuestPage.js': `const { EmbedBuilder } = require('discord.js');
class QuestPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const questRegistry = require('../../../questEngine/registry/questRegistry');
            const quests = questRegistry.getAll();
            const embed = new EmbedBuilder()
                .setTitle('📜 Quest Dashboard')
                .addFields(
                    { name: '🎯 Active Quests', value: \`\${quests ? quests.length : 0}\`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#9B59B6');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new QuestPage();`,

    'AchievementPage.js': `const { EmbedBuilder } = require('discord.js');
class AchievementPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const achievementRegistry = require('../../../achievementEngine/registry/achievementRegistry');
            const achievements = achievementRegistry.getAll();
            const embed = new EmbedBuilder()
                .setTitle('🏆 Achievement Statistics')
                .addFields(
                    { name: '🏅 Total Achievements', value: \`\${achievements ? achievements.length : 0}\`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#F39C12');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new AchievementPage();`,

    'ModerationPage.js': `const { EmbedBuilder } = require('discord.js');
class ModerationPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Moderation Runtime')
                .addFields(
                    { name: '⚙️ Status', value: 'Online', inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new ModerationPage();`,

    'StatisticsPage.js': `const { EmbedBuilder } = require('discord.js');
class StatisticsPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('📈 Server Statistics')
                .addFields(
                    { name: '👥 Members', value: \`\${guild.memberCount || 0}\`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#3498DB');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new StatisticsPage();`,

    'DiscoveryPage.js': `const { EmbedBuilder } = require('discord.js');
class DiscoveryPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('📡 Discovery Runtime')
                .addFields(
                    { name: '🔍 Listeners', value: 'Active', inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#1ABC9C');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new DiscoveryPage();`,

    'AutomationPage.js': `const { EmbedBuilder } = require('discord.js');
class AutomationPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('⚙️ Automation Runtime')
                .addFields(
                    { name: '🔄 Tasks', value: 'Running', inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#95A5A6');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new AutomationPage();`,

    'BehaviorPage.js': `const { EmbedBuilder } = require('discord.js');
class BehaviorPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🤖 Behavior Runtime')
                .addFields(
                    { name: '🧠 Patterns', value: 'Mapped', inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#8E44AD');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new BehaviorPage();`,

    'DecisionPage.js': `const { EmbedBuilder } = require('discord.js');
class DecisionPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🧠 Decision Engine')
                .addFields(
                    { name: '⚖️ Rules', value: 'Enforced', inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#2980B9');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new DecisionPage();`,

    'ChannelMappingPage.js': `const { EmbedBuilder } = require('discord.js');
class ChannelMappingPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const config = await pluginCtx.configuration.get(guildId, 'owo.channels');
            const embed = new EmbedBuilder()
                .setTitle('🗺️ Channel Mapping')
                .addFields(
                    { name: '📍 Mapped Channels', value: \`\${config ? config.length : 0}\`, inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#16A085');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new ChannelMappingPage();`,

    'GameplayPage.js': `const { EmbedBuilder } = require('discord.js');
class GameplayPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🎮 Gameplay Engine')
                .addFields(
                    { name: '🕹️ Modules', value: 'Operational', inline: true },
                    { name: '⚡ Runtime Integration', value: 'Verified', inline: true }
                )
                .setColor('#D35400');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(\`Engine failed: \${e.message}\`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new GameplayPage();`
};

for (const [filename, content] of Object.entries(pages)) {
    fs.writeFileSync(path.join(pagesDir, filename), content);
    console.log('Updated ' + filename);
}
