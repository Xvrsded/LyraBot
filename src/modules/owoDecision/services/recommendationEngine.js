const eventBus = require('../../../services/eventBus');
const decisionMetrics = require('./decisionMetrics');

class RecommendationEngine {
    constructor() {
        this.activeRecommendations = [];
    }

    recommend(context, message) {
        const rec = {
            id: Date.now().toString(),
            message,
            timestamp: new Date()
        };
        this.activeRecommendations.unshift(rec);
        if (this.activeRecommendations.length > 50) this.activeRecommendations.pop();

        eventBus.emit('decision.recommendation', { recommendation: rec, context });
        decisionMetrics.recordAction('recommend');
    }
}

module.exports = new RecommendationEngine();
