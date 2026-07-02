const mongoose = require('mongoose');

const TradeHistorySchema = new mongoose.Schema({
    tradeId: {
        type: String,
        required: true,
        unique: true
    },
    listingId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    sellerId: {
        type: String,
        required: true
    },
    buyerId: {
        type: String,
        required: true
    },
    itemId: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    pricePerUnit: {
        type: Number,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    completedAt: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    }
}, { timestamps: true });

TradeHistorySchema.index({ guildId: 1, sellerId: 1, completedAt: -1 });
TradeHistorySchema.index({ guildId: 1, buyerId: 1,  completedAt: -1 });
TradeHistorySchema.index({ guildId: 1, itemId: 1 });

module.exports = mongoose.model('TradeHistory', TradeHistorySchema);
