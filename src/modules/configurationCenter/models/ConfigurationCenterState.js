const mongoose = require('mongoose');

const ConfigurationCenterStateSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    owoIntegration: { type: Object, default: {} },
    channelMapping: { type: Object, default: {} },
    roleMapping: { type: Object, default: {} },
    leveling: { type: Object, default: {} },
    quest: { type: Object, default: {} },
    economy: { type: Object, default: {} },
    inventory: { type: Object, default: {} },
    marketplace: { type: Object, default: {} },
    notification: { type: Object, default: {} },
    automation: { type: Object, default: {} },
    permission: { type: Object, default: {} },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ConfigurationCenterState', ConfigurationCenterStateSchema);
