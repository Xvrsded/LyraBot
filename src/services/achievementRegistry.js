const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class AchievementRegistry {
    constructor() {
        this.achievements = new Map(); // achievementId -> definition
        this.eventMap = new Map(); // eventName -> Set of definitions
    }

    /**
     * Scans and loads all achievement JSON definitions from the achievements folder.
     * @returns {void}
     */
    loadAll() {
        this.achievements.clear();
        this.eventMap.clear();

        const achievementsDir = path.join(__dirname, '../../achievements');
        if (!fs.existsSync(achievementsDir)) {
            logger.warn(`[AchievementRegistry] Achievements directory does not exist at: ${achievementsDir}`);
            return;
        }

        try {
            const files = fs.readdirSync(achievementsDir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                const filePath = path.join(achievementsDir, file);
                const raw = fs.readFileSync(filePath, 'utf-8');
                const def = JSON.parse(raw);

                // Validation check
                if (!def.id || !def.title || !def.event || !def.target || !def.points) {
                    logger.warn(`[AchievementRegistry] Skip loading invalid achievement definition: "${file}"`);
                    continue;
                }

                this.achievements.set(def.id, def);

                if (!this.eventMap.has(def.event)) {
                    this.eventMap.set(def.event, new Set());
                }
                this.eventMap.get(def.event).add(def);
            }
            logger.info(`[AchievementRegistry] Successfully loaded ${this.achievements.size} achievement definitions.`);
        } catch (err) {
            logger.error('[AchievementRegistry] Failed to load achievement definitions:', err.message);
        }
    }

    /**
     * Gets a loaded achievement definition by ID.
     * @param {string} achievementId 
     * @returns {object|null}
     */
    getAchievement(achievementId) {
        return this.achievements.get(achievementId) || null;
    }

    /**
     * Gets all loaded achievement definitions.
     * @returns {object[]}
     */
    getAllAchievements() {
        return Array.from(this.achievements.values());
    }

    /**
     * Gets all achievements subscribing to a specific EventBus event name.
     * @param {string} eventName 
     * @returns {object[]}
     */
    getAchievementsForEvent(eventName) {
        const set = this.eventMap.get(eventName);
        return set ? Array.from(set) : [];
    }
}

module.exports = new AchievementRegistry();
