const { EmbedBuilder } = require('discord.js');
class EconomyPage {
    async render(guildId, guild, pluginCtx) {
        try {
            const ledger = await pluginCtx.economy.getLedger({ guildId }, 10);
            const Wallet = require('../../../models/Wallet');
            const totalWallets = await Wallet.countDocuments({ guildId });
            
            const embed = new EmbedBuilder()
                .setTitle('💰 Economy Dashboard')
                .addFields(
                    { name: '🏦 Registered Wallets', value: `${totalWallets}`, inline: true },
                    { name: '🔄 Recent Transactions', value: `${ledger.length}`, inline: true },
                    { name: '⚡ Runtime Engine', value: 'Active', inline: true },
                    { name: 'Latest Ledger', value: ledger.length ? ledger.map(l => `- [${l.type}] ${l.amount} (User: ${l.userId})`).join('\n') : 'No recent transactions.' }
                )
                .setColor('#F1C40F');
            return { embeds: [embed], components: [] };
        } catch (e) {
            const embed = new EmbedBuilder().setTitle('Error').setDescription(`Engine failed: ${e.message}`).setColor('#E74C3C');
            return { embeds: [embed], components: [] };
        }
    }
}
module.exports = new EconomyPage();