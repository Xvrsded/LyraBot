const mongoose = require('mongoose');

const ComponentHealthSchema = new mongoose.Schema({
    name: { type: String, required: true },
    status: { type: String, enum: ['ok', 'warning', 'failed'], default: 'ok' },
    message: { type: String, default: '' }
}, { _id: false });

const IntegrationHealthStateSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    overallHealth: { type: Number, default: 100 },
    components: [ComponentHealthSchema],
    warnings: [String],
    recommendations: [String],
    lastChecked: { type: Date, default: Date.now }
});

module.exports = mongoose.model('IntegrationHealthState', IntegrationHealthStateSchema);
