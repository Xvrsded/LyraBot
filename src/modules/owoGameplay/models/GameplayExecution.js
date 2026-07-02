const mongoose = require('mongoose');

const GameplayExecutionSchema = new mongoose.Schema({
    correlationId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    activity: { type: String, required: true },
    status: { type: String, enum: ['completed', 'failed', 'halted'], required: true },
    executionTime: { type: Number, required: true },
    rewards: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameplayExecution', GameplayExecutionSchema);
