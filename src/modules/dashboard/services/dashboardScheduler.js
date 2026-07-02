const DashboardState = require('../models/DashboardState');
const dashboardUpdater = require('./dashboardUpdater');
const logger = require('../../../utils/logger');
const eventBus = require('../../../services/eventBus');

class DashboardScheduler {
    constructor() {
        this.intervalId = null;
        this.running = false;
        // Polling loop interval (checks every 5 seconds)
        this.TICK_RATE = 5000;
    }

    start(client) {
        if (this.running) return;
        this.running = true;
        
        logger.info(`[DashboardScheduler] Starting Live Refresh Polling (Tick: ${this.TICK_RATE}ms)`);
        
        this.intervalId = setInterval(async () => {
            try {
                const states = await DashboardState.find({});
                const now = Date.now();

                for (const state of states) {
                    const lastRefresh = state.lastRefresh ? state.lastRefresh.getTime() : 0;
                    const intervalMs = (state.refreshInterval || 60) * 1000;

                    if (now - lastRefresh >= intervalMs) {
                        // Time to update!
                        state.lastRefresh = new Date(now);
                        await state.save(); // Save refresh time to prevent double execution if updater is slow
                        
                        // Fire and forget
                        dashboardUpdater.update(client, state).catch(err => {
                            logger.error(`[DashboardScheduler] Updater failed for guild ${state.guildId}:`, err);
                        });
                    }
                }
            } catch (error) {
                logger.error('[DashboardScheduler] Polling cycle error:', error);
            }
        }, this.TICK_RATE);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.running = false;
        logger.info('[DashboardScheduler] Stopped.');
    }
}

module.exports = new DashboardScheduler();
