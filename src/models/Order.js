const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true }, // Format: LB-XXXXXX
    userId: { type: String, required: true }, // Customer Discord ID
    productName: { type: String, required: true },
    price: { type: Number, required: true }, // Total Bayar (Rounded)
    subtotal: { type: Number, default: 0 }, // Raw price before rounding
    rounding: { type: Number, default: 0 }, // Round up delta (+RpX)
    status: { type: String, enum: ['pending', 'paid', 'success'], default: 'pending' },
    channelId: { type: String, required: true }, // Ticket channel ID
    details: { type: mongoose.Schema.Types.Mixed, default: {} }, // Key-value map of form responses
    snapshot: { type: mongoose.Schema.Types.Mixed, default: {} }, // Price, package, and rate info at the time of creation
    reviewGiven: { type: Boolean, default: false },
    rating: { type: Number, default: null },
    comment: { type: String, default: null },
    reviewDate: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
