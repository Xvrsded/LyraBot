const mongoose = require('mongoose');

const AchievementProgressSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    achievementId: {
        type: String,
        required: true
    },
    progress: {
        type: Number,
        default: 0
    },
    target: {
        type: Number,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    unlockedAt: {
        type: Date,
        required: false
    }
}, { timestamps: true });

AchievementProgressSchema.index({ guildId: 1, userId: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model('AchievementProgress', AchievementProgressSchema);
