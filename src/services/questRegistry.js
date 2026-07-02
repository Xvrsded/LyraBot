const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class QuestRegistry {
    constructor() {
        this.quests = new Map(); // questId -> questDefinition
        this.eventMap = new Map(); // eventName -> Set of questDefinitions
    }

    /**
     * Scans and loads all quest JSON definitions from the quests folder.
     * @returns {void}
     */
    loadAll() {
        this.quests.clear();
        this.eventMap.clear();

        const questsDir = path.join(__dirname, '../../quests');
        if (!fs.existsSync(questsDir)) {
            logger.warn(`[QuestRegistry] Quests directory does not exist at: ${questsDir}`);
            return;
        }

        try {
            const files = fs.readdirSync(questsDir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                const filePath = path.join(questsDir, file);
                const raw = fs.readFileSync(filePath, 'utf-8');
                const def = JSON.parse(raw);

                // Validation check
                if (!def.id || !def.title || !def.event || !def.target) {
                    logger.warn(`[QuestRegistry] Skip loading invalid quest: "${file}"`);
                    continue;
                }

                this.quests.set(def.id, def);

                if (!this.eventMap.has(def.event)) {
                    this.eventMap.set(def.event, new Set());
                }
                this.eventMap.get(def.event).add(def);
            }
            logger.info(`[QuestRegistry] Successfully loaded ${this.quests.size} quest definitions.`);
        } catch (err) {
            logger.error('[QuestRegistry] Failed to scan and load quest files:', err.message);
        }
    }

    /**
     * Gets a loaded quest definition by ID.
     * @param {string} questId 
     * @returns {object|null} Quest definition payload
     */
    getQuest(questId) {
        return this.quests.get(questId) || null;
    }

    /**
     * Gets all loaded quest definitions.
     * @returns {object[]}
     */
    getAllQuests() {
        return Array.from(this.quests.values());
    }

    /**
     * Gets all quests listening to a specific EventBus event name.
     * @param {string} eventName 
     * @returns {object[]}
     */
    getQuestsForEvent(eventName) {
        const set = this.eventMap.get(eventName);
        return set ? Array.from(set) : [];
    }
}

module.exports = new QuestRegistry();
