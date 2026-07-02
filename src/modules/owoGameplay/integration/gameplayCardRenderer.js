const gameplayMetrics = require('../services/gameplayMetrics');

async function renderGameplayCard(context) {
    const metrics = gameplayMetrics.metrics;
    const avgExecution = gameplayMetrics.getAverageExecution();
    
    let healthText = '🟢 Excellent';
    if (metrics.failed > metrics.success) healthText = '🔴 Critical Failure Rate';
    else if (metrics.failed > 0) healthText = '🟡 Degraded';

    return `**Health:** ${healthText}\n**Average Execution:** ${avgExecution}ms\n**Successful:** ${metrics.success}\n**Failed:** ${metrics.failed}\n**Halted (Cooldown):** ${metrics.halted}\n**Total Operations:** ${metrics.total}`;
}

module.exports = renderGameplayCard;
