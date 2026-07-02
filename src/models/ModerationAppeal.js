const mongoose = require('mongoose');

const ModerationAppealSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    caseNumber: {
        type: Number,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    userTag: {
        type: String,
        required: true
    },
    statement: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'approved', 'rejected', 'closed'],
        default: 'pending'
    },
    moderatorNote: {
        type: String,
        default: ''
    },
    resolvedBy: {
        type: String,
        required: false
    }
}, { timestamps: true });

ModerationAppealSchema.index({ guildId: 1, caseNumber: 1 }, { unique: true });

module.exports = mongoose.model('ModerationAppeal', ModerationAppealSchema);
