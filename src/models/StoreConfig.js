const mongoose = require('mongoose');

const StoreConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    stockChannelId: { type: String, default: null },
    messageId: { type: String, default: null },
    packages: { 
        type: [{ amount: Number, price: Number }],
        default: [
            { amount: 100, price: 15000 },
            { amount: 200, price: 30000 },
            { amount: 300, price: 45000 },
            { amount: 400, price: 60000 },
            { amount: 500, price: 75000 },
            { amount: 600, price: 90000 },
            { amount: 700, price: 105000 },
            { amount: 800, price: 120000 },
            { amount: 900, price: 135000 },
            { amount: 1000, price: 150000 }
        ] 
    },
    lastAvailable: { type: String, default: null },
    lastPersonalAvailable: { type: String, default: null },
    lastGroupAvailable: { type: String, default: null },
    lastPending: { type: String, default: null },
    lastUpdate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StoreConfig', StoreConfigSchema);
