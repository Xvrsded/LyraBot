const mongoose = require('mongoose');

const MemberProgressionSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    activeTitle: {
        type: String,
        default: ''
    },
    badges: {
        type: [String],
        default: []
    },
    titles: {
        type: [String],
        default: []
    },
    achievementPoints: {
        type: Number,
        default: 0
    },
    xp: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1
    },
    streakCount: {
        type: Number,
        default: 0
    },
    lastActiveDate: {
        type: String,
        required: false
    }
}, { timestamps: true });

MemberProgressionSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('MemberProgression', MemberProgressionSchema);
