const mongoose = require('mongoose');

const ModerationCaseSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    caseNumber: {
        type: Number,
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            'WARN', 'KICK', 'BAN', 'SOFTBAN', 'TIMEOUT', 
            'MUTE', 'UNMUTE', 'UNBAN', 'LOCK', 'UNLOCK', 
            'SLOWMODE', 'NICKNAME_RESET', 'ROLE_REMOVE'
        ]
    },
    targetId: {
        type: String,
        required: true
    },
    targetTag: {
        type: String,
        required: true
    },
    moderatorId: {
        type: String,
        required: true
    },
    moderatorTag: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        default: 'Tidak ada alasan yang diberikan.'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    correlationId: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Index for query and sorting
ModerationCaseSchema.index({ guildId: 1, caseNumber: 1 }, { unique: true });
ModerationCaseSchema.index({ guildId: 1, targetId: 1 });

module.exports = mongoose.model('ModerationCase', ModerationCaseSchema);
