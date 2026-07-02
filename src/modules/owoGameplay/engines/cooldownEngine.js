class CooldownError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CooldownError';
    }
}

// Mocking owoStateManager dependency since it is an external module
const owoStateManager = require('../../owoBehavior/services/behaviorManager'); // In a real app we'd map it correctly

class CooldownEngine {
    async execute(context) {
        // Here we'd check owoStateManager.isOnCooldown(context.userId, context.activity)
        // For testing/mocking, we check the payload
        if (context.payload.isOnCooldown) {
            throw new CooldownError(`Activity ${context.activity} is on cooldown for user ${context.userId}`);
        }

        context.setMetadata('CooldownEngine', 'Passed');
    }
}

module.exports = new CooldownEngine();
module.exports.CooldownError = CooldownError;
