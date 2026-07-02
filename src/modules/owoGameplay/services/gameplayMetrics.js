class GameplayMetrics {
    constructor() {
        this.metrics = {
            total: 0,
            success: 0,
            failed: 0,
            halted: 0,
            executionTimes: []
        };
    }

    recordSuccess(duration) {
        this.metrics.total++;
        this.metrics.success++;
        this.metrics.executionTimes.push(duration);
        if (this.metrics.executionTimes.length > 200) this.metrics.executionTimes.shift();
    }

    recordFailure() {
        this.metrics.total++;
        this.metrics.failed++;
    }

    recordHalt() {
        this.metrics.total++;
        this.metrics.halted++;
    }

    getAverageExecution() {
        if (this.metrics.executionTimes.length === 0) return 0;
        const sum = this.metrics.executionTimes.reduce((a, b) => a + b, 0);
        return Math.floor(sum / this.metrics.executionTimes.length);
    }
}

module.exports = new GameplayMetrics();
