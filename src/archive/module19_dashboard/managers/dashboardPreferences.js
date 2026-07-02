/**
 * dashboardPreferences.js — Manages per-user dashboard preferences
 */

const DashboardPreferences = require('../../models/DashboardPreferences');

class DashboardPreferencesManager {
    /**
     * Gets user preferences, creating defaults if they don't exist.
     */
    async getPreferences(userId) {
        let prefs = await DashboardPreferences.findOne({ userId });
        if (!prefs) {
            prefs = new DashboardPreferences({ userId });
            await prefs.save();
        }
        return prefs.toObject();
    }

    /**
     * Updates user preferences.
     */
    async updatePreferences(userId, updates) {
        const prefs = await DashboardPreferences.findOneAndUpdate(
            { userId },
            { $set: { ...updates, updatedAt: Date.now() } },
            { new: true, upsert: true }
        );
        return prefs.toObject();
    }
}

module.exports = new DashboardPreferencesManager();
