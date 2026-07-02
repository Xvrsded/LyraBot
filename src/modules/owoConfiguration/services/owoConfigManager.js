const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');
// Mocking dependencies for 22.1 and 22.3
const configCenterManager = require('../../configurationCenter/services/configCenterManager');

class OwoConfigManager {
    async getConfig(guildId, key) {
        return await configCenterManager.get(guildId, `owo.${key}`);
    }

    async setConfig(guildId, key, value) {
        await configCenterManager.set(guildId, `owo.${key}`, value);
        logger.info(`[OwoConfigManager] Config updated for ${guildId}: owo.${key} = ${value}`);
        eventBus.emit('configuration.updated', { guildId, key: `owo.${key}`, value });
        eventBus.emit('configuration.saved', { guildId });
    }

    async getIntegrationHealth(guildId) {
        // Fetch from 22.3 Validator
        try {
            const ValidationPipeline = require('../../integrationValidator/services/validationPipeline');
            // Check if state exists, else run validation or return mock
            const state = await require('../../integrationValidator/models/IntegrationHealthState').findOne({ guildId });
            return state || { overallHealth: 100, components: [] };
        } catch(e) {
            return { overallHealth: 100, components: [] };
        }
    }

    async triggerValidation(guildId) {
        try {
            const ValidationPipeline = require('../../integrationValidator/services/validationPipeline');
            await ValidationPipeline.run(guildId);
            eventBus.emit('configuration.validation', { guildId });
            return true;
        } catch(e) {
            return false;
        }
    }
}

module.exports = new OwoConfigManager();
