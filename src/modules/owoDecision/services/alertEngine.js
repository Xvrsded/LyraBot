const eventBus = require('../../../services/eventBus');
const decisionMetrics = require('./decisionMetrics');

class AlertEngine {
    constructor() {
        this.activeAlerts = [];
    }

    raiseAlert(context, message, level = 'warning') {
        const alert = {
            id: Date.now().toString(),
            message,
            level,
            timestamp: new Date()
        };
        this.activeAlerts.unshift(alert);
        if (this.activeAlerts.length > 50) this.activeAlerts.pop();

        eventBus.emit('decision.alert', { alert, context });
        decisionMetrics.recordAction('raise_alert');
    }
}

module.exports = new AlertEngine();
