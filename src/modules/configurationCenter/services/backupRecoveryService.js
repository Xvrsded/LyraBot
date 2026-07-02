const configCenterManager = require('./configCenterManager');
const eventBus = require('../../../services/eventBus');

class BackupRecoveryService {
    async exportConfig(guildId) {
        const config = await configCenterManager.get(guildId);
        eventBus.emit('configuration.exported', { guildId });
        return JSON.stringify(config, null, 2);
    }

    async importConfig(guildId, jsonString) {
        let parsed;
        try {
            parsed = JSON.parse(jsonString);
        } catch (e) {
            throw new Error('Invalid JSON format');
        }

        const categories = ['owoIntegration', 'channelMapping', 'roleMapping', 'leveling', 'quest', 'economy', 'inventory', 'marketplace', 'notification', 'automation', 'permission'];
        
        for (const cat of categories) {
            if (parsed[cat]) {
                // For simplicity, overwriting entire category object directly via set
                // In production, might want deep merge
                for (const [k, v] of Object.entries(parsed[cat])) {
                    await configCenterManager.set(guildId, `${cat}.${k}`, v);
                }
            }
        }

        eventBus.emit('configuration.imported', { guildId });
        return true;
    }

    async resetToTemplate(guildId) {
        await configCenterManager.reset(guildId);
        eventBus.emit('configuration.reset', { guildId });
    }
}

module.exports = new BackupRecoveryService();
