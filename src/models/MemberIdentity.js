const mongoose = require('mongoose');

const MemberIdentitySchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'verifying', 'active'],
        default: 'pending'
    },
    previousRoles: {
        type: [String],
        default: []
    },
    verificationAttempts: {
        type: Number,
        default: 0
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    verifiedAt: {
        type: Date,
        required: false
    }
}, { timestamps: true });

// Create compound index for fast queries
MemberIdentitySchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('MemberIdentity', MemberIdentitySchema);
