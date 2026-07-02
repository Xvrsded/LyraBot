const crypto = require('crypto');

class PipelineContext {
    constructor(guildId, userId, activity, payload) {
        this.correlationId = crypto.randomUUID();
        this.guildId = guildId;
        this.userId = userId;
        this.activity = activity;
        this.payload = payload;
        
        this.timestamps = {
            created: Date.now(),
            started: null,
            completed: null
        };
        
        this.executionTime = 0;
        this.stageTraces = []; // Logs what happened in each stage
        this.metadata = {}; // Space for stages to inject data for downstream
    }

    markStarted() {
        this.timestamps.started = Date.now();
    }

    markCompleted() {
        this.timestamps.completed = Date.now();
        this.executionTime = this.timestamps.completed - this.timestamps.started;
    }

    addTrace(stageId, status, duration, error = null) {
        this.stageTraces.push({
            stageId,
            status,
            duration,
            error: error ? error.message : null,
            timestamp: Date.now()
        });
    }

    setMetadata(key, value) {
        this.metadata[key] = value;
    }

    getMetadata(key) {
        return this.metadata[key];
    }
}

module.exports = PipelineContext;
