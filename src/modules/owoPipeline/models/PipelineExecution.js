const mongoose = require('mongoose');

const PipelineExecutionSchema = new mongoose.Schema({
    correlationId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    activity: { type: String, required: true },
    executionTime: { type: Number, required: true },
    status: { type: String, enum: ['success', 'failed', 'cancelled'], required: true },
    stageTraces: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PipelineExecution', PipelineExecutionSchema);
