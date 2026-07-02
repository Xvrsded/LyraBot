class DecisionMetrics {
    constructor() {
        this.metrics = {
            rulesEvaluated: 0,
            rulesMatched: 0,
            actionsExecuted: 0,
            actionsFailed: 0,
            actionCounts: {}
        };
    }

    recordEvaluation(matched) {
        this.metrics.rulesEvaluated++;
        if (matched) this.metrics.rulesMatched++;
    }

    recordAction(type) {
        this.metrics.actionsExecuted++;
        if (!this.metrics.actionCounts[type]) this.metrics.actionCounts[type] = 0;
        this.metrics.actionCounts[type]++;
    }

    recordFailure() {
        this.metrics.actionsFailed++;
    }
}

module.exports = new DecisionMetrics();
