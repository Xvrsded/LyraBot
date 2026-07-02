const mongoose = require('mongoose');

const LedgerEntrySchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    correlationId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    sourcePlugin: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: ['Reward', 'Purchase', 'Transfer', 'Tax', 'Refund', 'Penalty', 'Trade', 'Gift']
    },
    currency: {
        type: String,
        required: true,
        enum: ['coins', 'premiumCoins']
    },
    amount: {
        type: Number,
        required: true
    },
    balanceBefore: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    }
}, { timestamps: true });

LedgerEntrySchema.index({ guildId: 1, userId: 1, timestamp: -1 });

module.exports = mongoose.model('LedgerEntry', LedgerEntrySchema);
