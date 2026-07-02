const eventBus = require('../../../services/eventBus');

class DashboardEngine {
    async execute(context) {
        // Just trigger a dashboard update request via eventbus
        eventBus.emit('dashboard.gameplay.update', {
            guildId: context.guildId,
            activity: context.activity
        });

        context.setMetadata('DashboardEngine', 'Fired');
    }
}

module.exports = new DashboardEngine();
