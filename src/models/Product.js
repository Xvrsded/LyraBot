const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    channelId: { type: String, default: null }, // Discord channel where the buy panel is sent
    categoryId: { type: String, default: null }, // Discord category ID where the ticket channel is created
    staffRoleId: { type: String, default: null }, // Specific role to handle tickets for this product
    pricingType: { type: String, enum: ['PER_ROBUX', 'FIXED_PRICE'], default: 'FIXED_PRICE' },
    price: { type: Number, required: true, default: 0 },
    active: { type: Boolean, default: true },
    embed: {
        title: { type: String, default: 'Buy Product' },
        description: { type: String, default: 'Click the button below to buy.' },
        color: { type: String, default: '#0099ff' },
        thumbnail: { type: String, default: null },
        banner: { type: String, default: null },
        footer: { type: String, default: 'LyraBlox Store' }
    },
    button: {
        label: { type: String, default: 'Buy' },
        emoji: { type: String, default: '🛒' }
    },
    fields: [{
        customId: { type: String, required: true },
        label: { type: String, required: true },
        placeholder: { type: String, default: '' },
        required: { type: Boolean, default: true },
        style: { type: String, enum: ['SHORT', 'PARAGRAPH'], default: 'SHORT' }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
