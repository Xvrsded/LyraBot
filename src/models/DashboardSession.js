/**
 * DashboardSession Model
 * Stores long-lived refresh tokens and active sessions for the dashboard.
 */
const mongoose = require('mongoose');

const dashboardSessionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    sessionId: { type: String, required: true, unique: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String, default: 'unknown' },
    ipAddress: { type: String, default: 'unknown' },
    createdAt: { type: Date, default: Date.now }
});

// Index for quick cleanup of expired sessions
dashboardSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
dashboardSessionSchema.index({ userId: 1 });

module.exports = mongoose.model('DashboardSession', dashboardSessionSchema);
