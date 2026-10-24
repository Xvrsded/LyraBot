const mongoose = require('mongoose');

const PricelistItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    robux: { type: Number, required: true },
    customPrice: { type: Number, default: null }
}, { _id: false });

const PricelistCategorySchema = new mongoose.Schema({
    categoryId: { type: String, required: true, unique: true },
    buttonLabel: { type: String, required: true },
    buttonEmoji: { type: String, default: '📋' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#3b82f6' },
    displayOrder: { type: Number, default: 0 },
    items: [PricelistItemSchema],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('PricelistCategory', PricelistCategorySchema);
