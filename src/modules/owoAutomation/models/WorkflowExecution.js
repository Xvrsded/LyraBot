const mongoose = require('mongoose');

const WorkflowExecutionSchema = new mongoose.Schema({
    workflowId: { type: String, required: true, index: true },
    correlationId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    activity: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'], default: 'PENDING' },
    steps: [{
        module: { type: String },
        status: { type: String, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'] },
        error: { type: String, default: null },
        startTime: { type: Date },
        endTime: { type: Date }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WorkflowExecution', WorkflowExecutionSchema);
