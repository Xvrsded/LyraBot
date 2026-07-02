/**
 * DashboardPreferences Model
 * Stores user-specific UI settings for the Web Dashboard.
 */
const mongoose = require('mongoose');

const dashboardPreferencesSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
    accentColor: { type: String, default: '#5865F2' },
    language: { type: String, default: 'en' },
    sidebarState: { type: String, enum: ['expanded', 'collapsed'], default: 'expanded' },
    widgetLayout: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DashboardPreferences', dashboardPreferencesSchema);
