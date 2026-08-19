const mongoose = require('mongoose');

const LeaderboardTransactionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    messageId: { type: String, required: true, unique: true },
    createdAt: { type: Date, required: true }
});

module.exports = mongoose.model('LeaderboardTransaction', LeaderboardTransactionSchema);
