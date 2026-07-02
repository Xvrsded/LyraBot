const pipelineHealth = require('../pipeline/pipelineHealth');
const pipelineManager = require('../pipeline/pipelineManager');

async function renderPipelineCard(context) {
    const healthScore = pipelineHealth.getHealthScore();
    const metrics = pipelineHealth.metrics;
    const avgLatency = pipelineHealth.getAverageLatency();
    const activePipelines = pipelineManager.activePipelines.size;
    
    let statusText = '🟢 Operational';
    if (healthScore < 70) statusText = '🔴 Critical (Failing Pipelines)';
    else if (healthScore < 90) statusText = '🟡 Degraded';

    return `**Status:** ${statusText}\n**Health Score:** ${healthScore}%\n**Active Pipelines:** ${activePipelines}\n**Avg Latency:** ${avgLatency}ms\n**Total Executed:** ${metrics.total}\n**Total Failed:** ${metrics.failed}`;
}

module.exports = renderPipelineCard;
