const mongoose = require('mongoose');

const SetupWizardStateSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    currentStep: { type: Number, default: 1 },
    selectedTemplate: { type: String, default: null },
    configuration: { type: Object, default: {} },
    progress: { type: Number, default: 0 },
    status: { type: String, enum: ['idle', 'running', 'failed', 'completed'], default: 'idle' },
    rollbackData: {
        roles: [String],
        categories: [String],
        channels: [String]
    },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SetupWizardState', SetupWizardStateSchema);
