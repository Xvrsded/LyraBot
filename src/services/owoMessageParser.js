const logger = require('../utils/logger');

class OwOMessageParser {
    /**
     * Parses a text message from the OwO bot.
     * @param {Message} message Discord Message object
     * @returns {object|null} Normalized activity details or null if unsupported
     */
    parse(message) {
        const content = message.content;
        const guild = message.guild;

        if (!content) return null;

        // 1. Hunt completed parsing
        // Matches: **Username** found a :emoji: **PetName**! [Rank]
        const huntRegex = /\*\*(.*?)\*\* found a (?:<.*?>|:\w+:)? \*\*(.*?)\*\*! \[(.*?)\]/;
        const huntMatch = content.match(huntRegex);
        if (huntMatch) {
            const username = huntMatch[1];
            const petName = huntMatch[2];
            const rank = huntMatch[3];

            const member = this.resolveMember(guild, username);
            return {
                activity: 'hunt',
                userId: member ? member.id : null,
                username,
                payload: { petName, rank }
            };
        }

        // 2. Battle completed parsing
        // Matches: **Challenger** vs **Opponent**! **Winner** won
        const battleRegex = /\*\*(.*?)\*\* vs \*\*(.*?)\*\*! \*\*(.*?)\*\* won/;
        const battleMatch = content.match(battleRegex);
        if (battleMatch) {
            const challenger = battleMatch[1];
            const opponent = battleMatch[2];
            const winner = battleMatch[3];

            const member = this.resolveMember(guild, challenger);
            return {
                activity: 'battle',
                userId: member ? member.id : null,
                username: challenger,
                payload: { opponent, winner, won: challenger === winner }
            };
        }

        // 3. Daily claimed parsing
        // Matches English: claimed their daily **1,000 Cowoncy**
        // Matches Indonesian: kamu berhasil mengambil hadiah harian sebesar **1,500 Cowoncy**
        const dailyRegex = /\*\*(.*?)\*\*.*? (?:claimed their daily|kamu berhasil mengambil hadiah harian sebesar) \*\*(.*?)\*\*+/;
        const dailyMatch = content.match(dailyRegex);
        if (dailyMatch) {
            const username = dailyMatch[1];
            const amount = dailyMatch[2];

            const member = this.resolveMember(guild, username);
            return {
                activity: 'daily',
                userId: member ? member.id : null,
                username,
                payload: { amount }
            };
        }

        // 4. Gem used parsing
        // Matches: **Username** used a :gem: **GemName**
        const gemRegex = /\*\*(.*?)\*\* used a (?:<.*?>|:\w+:)? \*\*(.*?)\*\*+/;
        const gemMatch = content.match(gemRegex);
        if (gemMatch && content.includes('used a')) {
            const username = gemMatch[1];
            const gemName = gemMatch[2];

            const member = this.resolveMember(guild, username);
            return {
                activity: 'gem',
                userId: member ? member.id : null,
                username,
                payload: { gemName }
            };
        }

        return null; // Unsupported/unparsed activity
    }

    /**
     * Resolves a GuildMember object from their display username in text.
     * @private
     */
    resolveMember(guild, username) {
        if (!guild) return null;
        
        // Lookup username in server cache
        const cleanedName = username.toLowerCase().replace(/['"**_~`]/g, '').trim();
        return guild.members.cache.find(m => {
            const nameMatch = m.user.username.toLowerCase() === cleanedName;
            const displayMatch = m.displayName.toLowerCase() === cleanedName;
            return nameMatch || displayMatch;
        });
    }
}

module.exports = new OwOMessageParser();
