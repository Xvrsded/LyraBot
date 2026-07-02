const eventBus = require('../../../services/eventBus');

class NotificationManager {
    constructor() {
        this.notifications = []; // Max 100
    }

    init() {
        const notifEvents = [
            'quest.completed',
            'achievement.unlocked',
            'inventory.updated',
            'market.transaction',
            'plugin.loaded',
            'configuration.updated',
            'automation.completed'
        ];

        notifEvents.forEach(evt => {
            eventBus.subscribe(evt, (data) => {
                this.addNotification({
                    id: Date.now().toString(),
                    event: evt,
                    message: data.message || `Event: ${evt}`,
                    guildId: data.guildId || 'global',
                    timestamp: new Date()
                });
            });
        });
    }

    addNotification(notif) {
        this.notifications.unshift(notif);
        if (this.notifications.length > 100) this.notifications.pop();
    }

    getNotifications(guildId) {
        return this.notifications.filter(n => n.guildId === guildId || n.guildId === 'global');
    }
}

module.exports = new NotificationManager();
