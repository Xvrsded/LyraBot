const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true }, // Channel ID
    ownerId: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    productName: { type: String, default: '' },
    orderId: { type: String, default: null }, // Associated Order ID (LB-XXXXXX)
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', TicketSchema);
