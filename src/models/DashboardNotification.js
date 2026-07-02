/**
 * DashboardNotification Model
 * Stores persistent notifications for users in the web dashboard.
 */
const mongoose = require('mongoose');

const dashboardNotificationSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, required: true }, // e.g., 'SYSTEM', 'ECONOMY', 'MODERATION'
    title: { type: String, required: true },
    message: { type: String, required: true },
    actionUrl: { type: String, default: null },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

dashboardNotificationSchema.index({ userId: 1, isRead: 1 });
dashboardNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // Keep for 30 days

module.exports = mongoose.model('DashboardNotification', dashboardNotificationSchema);
