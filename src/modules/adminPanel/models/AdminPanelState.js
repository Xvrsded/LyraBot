const mongoose = require('mongoose');

const AdminPanelStateSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    currentTemplate: { type: String, default: 'base' },
    installedPanels: { type: [String], default: [] },
    lastUpdate: { type: Date, default: Date.now },
    panelVersion: { type: String, default: '1.0' },
    recoveryStatus: { type: String, enum: ['OK', 'PENDING', 'FAILED'], default: 'OK' }
});

module.exports = mongoose.model('AdminPanelState', AdminPanelStateSchema);
