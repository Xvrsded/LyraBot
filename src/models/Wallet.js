const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    coins: {
        type: Number,
        default: 0
    },
    premiumCoins: {
        type: Number,
        default: 0
    },
    experience: {
        type: Number,
        default: 0
    },
    lifetimeEarnings: {
        type: Number,
        default: 0
    },
    lifetimeSpending: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

WalletSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Wallet', WalletSchema);
