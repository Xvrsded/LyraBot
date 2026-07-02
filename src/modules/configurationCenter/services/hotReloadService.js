const eventBus = require('../../../services/eventBus');

class HotReloadService {
    broadcastUpdate(guildId, category, key, value) {
        eventBus.emit('configuration.updated', {
            guildId,
            category,
            key,
            value,
            timestamp: Date.now()
        });
    }
}

module.exports = new HotReloadService();
