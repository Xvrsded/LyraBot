/**
 * dashboardStatistics.js — Tracks dashboard metrics
 */

const DashboardSession = require('../../models/DashboardSession');

class DashboardStatistics {
    constructor() {
        this.loginCount = 0;
        this.widgetLoadCounts = new Map();
    }

    recordLogin() {
        this.loginCount++;
    }

    recordWidgetLoad(widgetId) {
        const current = this.widgetLoadCounts.get(widgetId) || 0;
        this.widgetLoadCounts.set(widgetId, current + 1);
    }

    async getStats() {
        const activeSessions = await DashboardSession.countDocuments({ expiresAt: { $gt: new Date() } });
        return {
            loginCount: this.loginCount,
            activeSessions,
            widgetLoads: Object.fromEntries(this.widgetLoadCounts)
        };
    }
}

module.exports = new DashboardStatistics();
