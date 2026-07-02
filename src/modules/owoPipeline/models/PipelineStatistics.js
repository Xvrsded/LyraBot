const mongoose = require('mongoose');

const PipelineStatisticsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    totalPipelines: { type: Number, default: 0 },
    successPipelines: { type: Number, default: 0 },
    failedPipelines: { type: Number, default: 0 },
    averageLatency: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PipelineStatistics', PipelineStatisticsSchema);
