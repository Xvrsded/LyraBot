const mongoose = require('mongoose');

const leaderboardStateSchema = new mongoose.Schema({
    id: { type: String, default: 'global', unique: true },
    lastSyncedMessageId: { type: String, default: null },
    leaderboardMessageId: { type: String, default: null }
}, {
    timestamps: true
});

module.exports = mongoose.model('LeaderboardState', leaderboardStateSchema);
