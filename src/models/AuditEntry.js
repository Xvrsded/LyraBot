const mongoose = require('mongoose');

const AuditEntrySchema = new mongoose.Schema({
    auditId: {
        type: String,
        required: true,
        unique: true
    },
    correlationId: {
        type: String,
        required: true
    },
    plugin: {
        type: String,
        required: true,
        default: 'core'
    },
    guildId: {
        type: String,
        required: false
    },
    userId: {
        type: String,
        required: false
    },
    targetId: {
        type: String,
        required: false
    },
    action: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        required: true,
        enum: ['Info', 'Warning', 'Error', 'Critical', 'Security'],
        default: 'Info'
    },
    before: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    after: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    duration: {
        type: Number,
        default: 0 // Duration in ms
    }
}, { timestamps: true });

// Indexes for high-speed queries
AuditEntrySchema.index({ guildId: 1, timestamp: -1 });
AuditEntrySchema.index({ correlationId: 1 });
AuditEntrySchema.index({ plugin: 1, action: 1 });

module.exports = mongoose.model('AuditEntry', AuditEntrySchema);
