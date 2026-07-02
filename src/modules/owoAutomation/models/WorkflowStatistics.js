const mongoose = require('mongoose');

const WorkflowStatisticsSchema = new mongoose.Schema({
    module: { type: String, required: true, index: true },
    activity: { type: String, required: true, index: true },
    executions: { type: Number, default: 0 },
    successes: { type: Number, default: 0 },
    failures: { type: Number, default: 0 },
    retries: { type: Number, default: 0 },
    totalExecutionTimeMs: { type: Number, default: 0 }, // Used for average
    slowExecutions: { type: Number, default: 0 } // Executions taking > 1000ms
});

module.exports = mongoose.model('WorkflowStatistics', WorkflowStatisticsSchema);
