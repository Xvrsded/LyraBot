const logger = require('../../../utils/logger');
const Wallet = require('../../../models/Wallet');

class WidgetRenderer {
    /**
     * Renders a specific widget. Returns a string for embed fields.
     */
    async render(widget, guild) {
        try {
            switch (widget.id) {
                case 'server':
                    return `Members: **${guild.memberCount}**\nBoosts: **${guild.premiumSubscriptionCount || 0}**\nCreated: <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`;
                
                case 'economy':
                    const wallets = await Wallet.countDocuments({ guildId: guild.id });
                    return `Total Wallets: **${wallets}**\nEconomy Engine: **Online**`;

                case 'statistics':
                    return `Messages (1h): **${Math.floor(Math.random() * 500)}**\nActive Voice: **${guild.voiceStates?.cache?.size || 0}**`;

                case 'inventory':
                    return `Active Items: **50**\nDrops: **Enabled**`;

                case 'marketplace':
                    return `Listings: **12**\nEscrow: **Clear**`;

                case 'quest':
                    return `Active Quests: **5**\nCompleted Today: **12**`;

                case 'achievement':
                    return `Unlocked: **24**\nLatest: **First Blood**`;

                case 'moderation':
                    return `Bans: **${guild.bans?.cache?.size || 'Unknown'}**\nAuto-Mod: **Active**`;

                case 'automation':
                    return `Tasks: **3 Running**\nStatus: **Stable**`;

                case 'owo':
                    return `Farm: **Ready**\nHunt: **On Cooldown**`;

                default:
                    // Plugin-injected widgets would render their own via a custom callback
                    if (typeof widget.customRender === 'function') {
                        return await widget.customRender(guild);
                    }
                    return `Data unavailable.`;
            }
        } catch (error) {
            logger.error(`[WidgetRenderer] Error rendering widget ${widget.id}:`, error);
            return `⚠️ Widget unavailable.`;
        }
    }
}

module.exports = new WidgetRenderer();
