const eventBus = require('../../../services/eventBus');

class NotificationEngine {
    async execute(context) {
        eventBus.emit('gameplay.completed', {
            guildId: context.guildId,
            userId: context.userId,
            activity: context.activity,
            correlationId: context.correlationId
        });
        
        // Example: Emit specific notifications based on downstream metadata
        const economy = context.getMetadata('EconomyAdapter');
        if (economy && economy.coinsGranted > 0) {
            eventBus.emit('gameplay.rewarded', {
                guildId: context.guildId,
                userId: context.userId,
                coins: economy.coinsGranted
            });
        }
        
        context.setMetadata('NotificationEngine', 'Fired');
    }
}

module.exports = new NotificationEngine();
