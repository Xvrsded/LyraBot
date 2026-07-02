const mongoose = require('mongoose');

const MarketListingSchema = new mongoose.Schema({
    listingId: {
        type: String,
        required: true,
        unique: true
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
    itemId: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    pricePerUnit: {
        type: Number,
        required: true,
        min: 1
    },
    totalPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'sold', 'cancelled', 'expired'],
        default: 'active',
        index: true
    },
    escrowId: {
        type: String,
        required: true
    },
    buyerId: {
        type: String,
        default: null
    },
    soldAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        default: null   // null = never expires
    },
    featured: {
        type: Boolean,
        default: false
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    }
}, { timestamps: true });

MarketListingSchema.index({ guildId: 1, status: 1 });
MarketListingSchema.index({ guildId: 1, sellerId: 1 });
MarketListingSchema.index({ guildId: 1, itemId: 1, status: 1 });
MarketListingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('MarketListing', MarketListingSchema);
