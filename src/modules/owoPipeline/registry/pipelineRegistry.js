const activities = require('./activities.json');

class PipelineRegistry {
    constructor() {
        this.metadata = new Map();
        this.stages = new Map(); // id -> stage metadata
    }

    init() {
        for (const [key, value] of Object.entries(activities)) {
            this.metadata.set(key, value);
        }
    }

    getActivityMetadata(activityName) {
        return this.metadata.get(activityName) || {
            enabled: true,
            priority: 10,
            timeout: 5000,
            retryPolicy: 'drop'
        }; // Default fallback
    }

    registerStage(id, stageInstance, metadata = { abortOnFail: false, isParallel: false }) {
        this.stages.set(id, { instance: stageInstance, ...metadata });
    }

    getStage(id) {
        return this.stages.get(id);
    }

    getAllStages() {
        return Array.from(this.stages.entries()).map(([id, data]) => ({ id, ...data }));
    }
}

module.exports = new PipelineRegistry();
