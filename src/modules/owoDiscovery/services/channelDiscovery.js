const configMapper = require('./configMapper');
const logger = require('../../../utils/logger');

class ChannelDiscovery {
    constructor() {
        // Map of regex patterns to Config keys
        this.channelPatterns = [
            { key: 'owo.mainChannel', pattern: /\bowo\b/i },
            { key: 'owo.questChannel', pattern: /\bquest\b/i },
            { key: 'owo.marketChannel', pattern: /\bmarket\b/i },
            { key: 'owo.dropChannel', pattern: /\bdrops?\b/i },
            { key: 'owo.leaderboardChannel', pattern: /\bleaderboard\b/i },
            { key: 'admin.panelChannel', pattern: /\badmin-panel\b/i },
            { key: 'logs.channel', pattern: /\blogs?\b/i }
        ];
    }

    /**
     * Scans a specific channel to see if it matches any known patterns.
     * If so, maps it to ConfigService.
     */
    async evaluateChannel(channel) {
        if (!channel || !channel.name || !channel.guild) return false;

        for (const item of this.channelPatterns) {
            if (item.pattern.test(channel.name)) {
                logger.debug(`[ChannelDiscovery] Matched ${channel.name} to ${item.key}`);
                await configMapper.map(channel.guild.id, item.key, channel.id, channel.name);
                return true;
            }
        }
        return false;
    }

    /**
     * Scans all channels in a guild.
     */
    async scanGuild(guild) {
        if (!guild || !guild.channels) return 0;
        
        let mappedCount = 0;
        const channels = await guild.channels.fetch().catch(() => null);
        if (!channels) return 0;

        for (const [id, channel] of channels) {
            if (channel && channel.type === 0) { // GUILD_TEXT
                const mapped = await this.evaluateChannel(channel);
                if (mapped) mappedCount++;
            }
        }
        return mappedCount;
    }
}

module.exports = new ChannelDiscovery();
