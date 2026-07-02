const mongoose = require('mongoose');

const QuestProgressSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    questId: {
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
    claimed: {
        type: Boolean,
        default: false
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        required: false
    }
}, { timestamps: true });

QuestProgressSchema.index({ guildId: 1, userId: 1, questId: 1 }, { unique: true });

module.exports = mongoose.model('QuestProgress', QuestProgressSchema);
