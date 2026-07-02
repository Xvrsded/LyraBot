class PipelineHealth {
    constructor() {
        this.metrics = {
            total: 0,
            success: 0,
            failed: 0,
            executionTimes: []
        };
    }

    recordSuccess(duration) {
        this.metrics.total++;
        this.metrics.success++;
        this.metrics.executionTimes.push(duration);
        if (this.metrics.executionTimes.length > 100) {
            this.metrics.executionTimes.shift(); // Keep last 100
        }
    }

    recordFailure() {
        this.metrics.total++;
        this.metrics.failed++;
    }

    getAverageLatency() {
        if (this.metrics.executionTimes.length === 0) return 0;
        const sum = this.metrics.executionTimes.reduce((a, b) => a + b, 0);
        return Math.floor(sum / this.metrics.executionTimes.length);
    }

    getHealthScore() {
        if (this.metrics.total === 0) return 100;
        const score = (this.metrics.success / this.metrics.total) * 100;
        return Math.floor(score);
    }
}

module.exports = new PipelineHealth();
