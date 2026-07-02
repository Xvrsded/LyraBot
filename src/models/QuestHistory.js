const mongoose = require('mongoose');

const QuestHistorySchema = new mongoose.Schema({
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
    title: {
        type: String,
        required: true
    },
    rewards: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

QuestHistorySchema.index({ guildId: 1, userId: 1, completedAt: -1 });

module.exports = mongoose.model('QuestHistory', QuestHistorySchema);
