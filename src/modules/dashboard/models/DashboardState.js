const mongoose = require('mongoose');

const DashboardStateSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    template: { type: String, default: 'default' },
    layout: { type: String, default: 'default' },
    widgets: { type: [String], default: [] }, // Array of widget IDs
    refreshInterval: { type: Number, default: 60 },
    lastRender: { type: Date },
    lastRefresh: { type: Date },
    lastInteraction: { type: Date },
    version: { type: String, default: '1.0' },
    hash: { type: String }
});

module.exports = mongoose.model('DashboardState', DashboardStateSchema);
