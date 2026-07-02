class HealthReportPage {
    render(state) {
        if (!state) return { content: 'No health report generated yet.' };

        let content = `**Enterprise Integration Health Report**\n`;
        content += `Overall Health: **${state.overallHealth}%**\n\n`;

        for (const comp of state.components) {
            const icon = comp.status === 'ok' ? '🟢' : (comp.status === 'warning' ? '🟡' : '🔴');
            content += `${icon} **${comp.name}**: ${comp.status.toUpperCase()}\n`;
        }

        if (state.warnings.length > 0) {
            content += `\n**Warnings:**\n- ${state.warnings.join('\n- ')}`;
        }
        if (state.recommendations.length > 0) {
            content += `\n**Recommendations:**\n- ${state.recommendations.join('\n- ')}`;
        }

        return {
            content,
            components: [
                { type: 'button', label: 'Run Sync & Auto Fix', id: 'health_run_sync', style: 'primary' },
                { type: 'button', label: 'Back', id: 'health_back' }
            ]
        };
    }
}

module.exports = new HealthReportPage();
