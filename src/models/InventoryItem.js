const mongoose = require('mongoose');

const InventoryItemSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    itemId: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1,
        min: 1
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    },
    expiresAt: {
        type: Date,
        default: null  // null = never expires
    },
    acquiredAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Compound index for fast per-user inventory queries
InventoryItemSchema.index({ guildId: 1, userId: 1 });
// Compound index for specific item lookup
InventoryItemSchema.index({ guildId: 1, userId: 1, itemId: 1 }, { unique: true });
// TTL index — MongoDB auto-removes expired items (expiry scanner also runs in engine)
InventoryItemSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('InventoryItem', InventoryItemSchema);
