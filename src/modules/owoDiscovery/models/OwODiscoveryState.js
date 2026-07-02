const mongoose = require('mongoose');

const OwODiscoveryStateSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    migrated: { type: Boolean, default: false },
    healthScore: { type: Number, default: 0 },
    lastScan: { type: Date },
    missingEntities: { type: [String], default: [] }
});

module.exports = mongoose.model('OwODiscoveryState', OwODiscoveryStateSchema);
