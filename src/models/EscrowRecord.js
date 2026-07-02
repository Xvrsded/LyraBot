const mongoose = require('mongoose');

const EscrowRecordSchema = new mongoose.Schema({
    escrowId: {
        type: String,
        required: true,
        unique: true
    },
    listingId: {
        type: String,
        required: true,
        index: true
    },
    guildId: {
        type: String,
        required: true
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
    status: {
        type: String,
        enum: ['held', 'released', 'returned'],
        default: 'held'
    },
    releasedTo: {
        type: String,      // userId of who received the item
        default: null
    },
    releasedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

EscrowRecordSchema.index({ guildId: 1, sellerId: 1 });

module.exports = mongoose.model('EscrowRecord', EscrowRecordSchema);
