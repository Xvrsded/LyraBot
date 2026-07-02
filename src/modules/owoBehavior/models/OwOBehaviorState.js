const mongoose = require('mongoose');

const OwOBehaviorStateSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    channels: { type: Map, of: String, default: {} },
    categories: { type: Map, of: String, default: {} },
    roles: { type: Map, of: String, default: {} },
    healthScore: { type: Number, default: 0 },
    missingBehaviors: { type: [String], default: [] },
    lastScan: { type: Date }
});

module.exports = mongoose.model('OwOBehaviorState', OwOBehaviorStateSchema);
