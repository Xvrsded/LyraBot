const mongoose = require('mongoose');

const ItemUsageLogSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true
    },
    itemId: {
        type: String,
        required: true
    },
    usedAt: {
        type: Date,
        default: Date.now
    },
    effectsApplied: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    success: {
        type: Boolean,
        default: true
    },
    failReason: {
        type: String,
        default: null
    }
}, { timestamps: true });

ItemUsageLogSchema.index({ guildId: 1, userId: 1, usedAt: -1 });
ItemUsageLogSchema.index({ guildId: 1, itemId: 1 });

module.exports = mongoose.model('ItemUsageLog', ItemUsageLogSchema);
