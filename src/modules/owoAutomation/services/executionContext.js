const crypto = require('crypto');

class ExecutionContext {
    constructor({ guildId, memberId, channelId, activity, payload, behaviorId }) {
        this.correlationId = crypto.randomUUID();
        this.timestamp = new Date();
        this.guildId = guildId;
        this.memberId = memberId;
        this.channelId = channelId;
        this.activity = activity;
        this.payload = payload;
        this.behaviorId = behaviorId;
        
        // Modules can append data to this context to pass to the next module
        this.state = {};
    }

    set(key, value) {
        this.state[key] = value;
    }

    get(key) {
        return this.state[key];
    }
}

module.exports = ExecutionContext;
