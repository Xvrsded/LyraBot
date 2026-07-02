const decisionMetrics = require('../services/decisionMetrics');
const recommendationEngine = require('../services/recommendationEngine');
const alertEngine = require('../services/alertEngine');
const reminderEngine = require('../services/reminderEngine');

async function renderDecisionCard(context) {
    const metrics = decisionMetrics.metrics;
    const activeAlerts = alertEngine.activeAlerts.length;
    const activeRecs = recommendationEngine.activeRecommendations.length;
    const activeReminders = reminderEngine.scheduledReminders.size;
    
    let healthText = '🟢 Stable';
    if (activeAlerts > 10) healthText = '🔴 Critical (Too many alerts)';
    else if (activeAlerts > 0) healthText = '🟡 Attention Required';

    return `**Health:** ${healthText}\n**Rules Evaluated:** ${metrics.rulesEvaluated}\n**Rules Matched:** ${metrics.rulesMatched}\n**Actions Executed:** ${metrics.actionsExecuted}\n**Active Alerts:** ${activeAlerts}\n**Recommendations:** ${activeRecs}\n**Scheduled Reminders:** ${activeReminders}`;
}

module.exports = renderDecisionCard;
