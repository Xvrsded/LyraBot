const mongoose = require('mongoose');

const topSpenderSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    totalSpending: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    lastPurchase: { type: Date, default: Date.now },
    customerRank: { type: Number },
    customerBadge: { type: String }
}, {
    timestamps: true
});

module.exports = mongoose.model('TopSpender', topSpenderSchema);
