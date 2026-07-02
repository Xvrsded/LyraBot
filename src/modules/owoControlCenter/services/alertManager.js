const eventBus = require('../../../services/eventBus');

class AlertManager {
    constructor() {
        this.alerts = []; // In-memory, max 50
    }

    init() {
        const alertEvents = [
            'workflow.failed',
            'economy.transfer.failed',
            'market.transaction.failed',
            'automation.warning',
            'channel.deleted',
            'role.deleted',
            'database.offline',
            'gateway.reconnecting'
        ];

        alertEvents.forEach(evt => {
            eventBus.subscribe(evt, (data) => {
                this.addAlert({
                    id: Date.now().toString(),
                    event: evt,
                    message: data.message || `Alert: ${evt}`,
                    guildId: data.guildId || 'global',
                    read: false,
                    timestamp: new Date()
                });
            });
        });
    }

    addAlert(alert) {
        this.alerts.unshift(alert);
        if (this.alerts.length > 50) this.alerts.pop();
    }

    getUnreadCount(guildId) {
        return this.alerts.filter(a => (a.guildId === guildId || a.guildId === 'global') && !a.read).length;
    }

    getAlerts(guildId) {
        return this.alerts.filter(a => a.guildId === guildId || a.guildId === 'global');
    }

    markAsRead(id) {
        const a = this.alerts.find(x => x.id === id);
        if (a) a.read = true;
    }

    dismiss(id) {
        this.alerts = this.alerts.filter(x => x.id !== id);
    }
}

module.exports = new AlertManager();
