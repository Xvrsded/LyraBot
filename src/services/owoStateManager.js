class OwOStateManager {
    constructor() {
        this.states = new Map(); // userId -> { cooldowns: { hunt: Date, battle: Date }, quest: {} }
    }

    /**
     * Retrieves or initializes member state.
     * @param {string} userId 
     * @returns {object} Member state
     */
    getState(userId) {
        if (!this.states.has(userId)) {
            this.states.set(userId, {
                cooldowns: {
                    hunt: null,
                    battle: null
                },
                quests: {}
            });
        }
        return this.states.get(userId);
    }

    /**
     * Updates cooldown timestamp for an activity.
     * @param {string} userId 
     * @param {string} activity 'hunt' or 'battle'
     * @param {number} cooldownMs Duration in ms
     * @returns {void}
     */
    updateCooldown(userId, activity, cooldownMs) {
        const state = this.getState(userId);
        state.cooldowns[activity] = new Date(Date.now() + cooldownMs);
    }

    /**
     * Gets cooldown active remaining time.
     * @param {string} userId 
     * @param {string} activity 
     * @returns {number} Cooldown remaining in ms (0 if ready)
     */
    getCooldown(userId, activity) {
        const state = this.states.get(userId);
        if (!state || !state.cooldowns[activity]) return 0;
        
        const remaining = state.cooldowns[activity].getTime() - Date.now();
        return Math.max(0, remaining);
    }
}

module.exports = new OwOStateManager();
