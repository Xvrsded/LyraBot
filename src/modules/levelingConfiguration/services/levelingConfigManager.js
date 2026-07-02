const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');
// Mocking configCenterManager
const configCenterManager = require('../../configurationCenter/services/configCenterManager');

class LevelingConfigManager {
    async getConfig(guildId, key) {
        return await configCenterManager.get(guildId, `leveling.${key}`);
    }

    async setConfig(guildId, key, value) {
        await configCenterManager.set(guildId, `leveling.${key}`, value);
        logger.info(`[LevelingConfigManager] Config updated for ${guildId}: leveling.${key} = ${value}`);
        
        let eventPrefix = 'leveling.configuration.updated';
        if (key.includes('formula')) eventPrefix = 'leveling.formula.updated';
        else if (key.includes('role')) eventPrefix = 'leveling.role.updated';
        else if (key.includes('announcement')) eventPrefix = 'leveling.announcement.updated';
        else if (key.includes('leaderboard')) eventPrefix = 'leveling.leaderboard.updated';
        else if (key.includes('multiplier')) eventPrefix = 'leveling.multiplier.updated';

        eventBus.emit(eventPrefix, { guildId, key: `leveling.${key}`, value });
    }

    validateFormula(formula) {
        // Safe math parser validation
        // Allow numbers, spaces, operators (+, -, *, /, ^), parentheses, and 'level' keyword.
        if (typeof formula !== 'string') return false;
        const validRegex = /^[\d\s+\-*/^()level]+$/;
        if (!validRegex.test(formula)) return false;
        
        // Prevent code execution attempts or missing operands
        try {
            // Very simple token substitution test to ensure it evaluates
            const testFormula = formula.replace(/level/g, '1');
            // We do a mock evaluation using a safe sandbox or manual parser.
            // For validation, we just verify the regex passed and parenthesis match.
            let balance = 0;
            for (const char of testFormula) {
                if (char === '(') balance++;
                if (char === ')') balance--;
                if (balance < 0) return false;
            }
            return balance === 0;
        } catch(e) {
            return false;
        }
    }
}

module.exports = new LevelingConfigManager();
