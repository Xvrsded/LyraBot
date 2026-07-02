const mongoose = require('mongoose');

const JobHistorySchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ScheduledJob',
        required: false
    },
    jobName: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['success', 'failed']
    },
    startedAt: {
        type: Date,
        required: true
    },
    completedAt: {
        type: Date,
        required: true
    },
    durationMs: {
        type: Number,
        required: true
    },
    error: {
        type: String,
        required: false
    },
    retryAttempt: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('JobHistory', JobHistorySchema);
