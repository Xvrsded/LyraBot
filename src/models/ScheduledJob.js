const mongoose = require('mongoose');

const ScheduledJobSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        required: true,
        enum: ['cron', 'interval', 'delayed', 'once']
    },
    pattern: {
        type: String, // Cron expression (e.g. '*/5 * * * *') or interval value (e.g. '60000')
        required: false
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    },
    status: {
        type: String,
        required: true,
        enum: ['active', 'paused', 'completed', 'failed'],
        default: 'active'
    },
    nextRunAt: {
        type: Date,
        required: false
    },
    lastRunAt: {
        type: Date,
        required: false
    },
    retryCount: {
        type: Number,
        default: 0
    },
    maxRetries: {
        type: Number,
        default: 3
    },
    retryDelay: {
        type: Number,
        default: 5000 // default 5 seconds
    }
}, { timestamps: true });

module.exports = mongoose.model('ScheduledJob', ScheduledJobSchema);
