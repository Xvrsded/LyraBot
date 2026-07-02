const eventBus = require('../../../services/eventBus');
const decisionMetrics = require('./decisionMetrics');

class ReminderEngine {
    constructor() {
        this.scheduledReminders = new Map();
    }

    scheduleReminder(context, message, delayMs) {
        const reminderId = `${context.correlationId}_${Date.now()}`;
        
        const timeout = setTimeout(() => {
            eventBus.emit('decision.reminder', { message, context });
            this.scheduledReminders.delete(reminderId);
        }, delayMs);

        this.scheduledReminders.set(reminderId, timeout);
        decisionMetrics.recordAction('schedule_reminder');
    }
}

module.exports = new ReminderEngine();
