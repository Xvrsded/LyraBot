const mongoose = require('mongoose');

const MMFeeSchema = new mongoose.Schema({
    minAmount: { type: Number, required: true },
    maxAmount: { type: Number, required: true },
    fee: { type: Number, required: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: String, default: 'System' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MMFee', MMFeeSchema);
