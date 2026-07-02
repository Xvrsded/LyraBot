const OwODiscoveryState = require('../models/OwODiscoveryState');
const configService = require('../../../services/configService');
const logger = require('../../../utils/logger');

class HealthScanner {
    constructor() {
        this.requiredKeys = [
            'owo.mainChannel',
            'owo.questChannel',
            'admin.panelChannel',
            'roles.admin',
            'roles.verified'
        ];
    }

    /**
     * Scans a guild to check if all required configuration keys exist and point to valid entities.
     * @returns {Object} { healthScore: number, missing: string[] }
     */
    async scan(guild) {
        if (!guild) return { healthScore: 0, missing: this.requiredKeys };

        let missing = [];
        let valid = 0;

        for (const key of this.requiredKeys) {
            const config = await configService.getConfig(guild.id);
            const id = key.split('.').reduce((o, i) => o ? o[i] : null, config);
            if (!id) {
                missing.push(key);
                continue;
            }

            // Verify existence in guild
            if (key.startsWith('roles.')) {
                const role = await guild.roles.fetch(id).catch(() => null);
                if (!role) missing.push(key);
                else valid++;
            } else {
                const channel = await guild.channels.fetch(id).catch(() => null);
                if (!channel) missing.push(key);
                else valid++;
            }
        }

        const score = Math.floor((valid / this.requiredKeys.length) * 100);
        
        let state = await OwODiscoveryState.findOne({ guildId: guild.id });
        if (!state) state = new OwODiscoveryState({ guildId: guild.id });
        
        state.healthScore = score;
        state.missingEntities = missing;
        state.lastScan = new Date();
        await state.save();

        if (score < 100) {
            logger.warn(`[HealthScanner] Guild ${guild.id} health is ${score}%. Missing: ${missing.join(', ')}`);
        } else {
            logger.info(`[HealthScanner] Guild ${guild.id} health is 100%.`);
        }

        return { healthScore: score, missing };
    }
}

module.exports = new HealthScanner();
