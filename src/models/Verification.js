const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['waiting', 'active', 'passed', 'failed'],
        default: 'waiting'
    },
    attempt: {
        type: Number,
        default: 0
    },
    lastAttempt: {
        type: Date
    },
    cooldownUntil: {
        type: Date
    },
    verified: {
        type: Boolean,
        default: false
    },
    verifiedAt: {
        type: Date
    },
    // To store active session data (selected questions and current answers)
    activeSession: {
        type: Object,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Verification', verificationSchema);
