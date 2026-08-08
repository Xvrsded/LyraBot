const Config = require('../models/Config');

const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds cache to prevent Discord 3-second interaction timeouts

class SettingsService {
    /**
     * Get a setting by key.
     * @param {string} key Configuration key
     * @param {any} defaultValue Default value if key is not found
     * @returns {Promise<any>}
     */
    async get(key, defaultValue = null) {
        if (cache.has(key)) {
            const entry = cache.get(key);
            if (Date.now() - entry.time < CACHE_TTL) {
                return entry.value;
            }
        }
        try {
            const doc = await Config.findOne({ key });
            const value = doc ? doc.value : defaultValue;
            cache.set(key, { value, time: Date.now() });
            return value;
        } catch (err) {
            console.error(`[SettingsService] Error getting key "${key}":`, err);
            return defaultValue;
        }
    }

    /**
     * Set a setting by key.
     * @param {string} key Configuration key
     * @param {any} value Value to store
     * @returns {Promise<void>}
     */
    async set(key, value) {
        try {
            const doc = await Config.findOneAndUpdate(
                { key },
                { key, value },
                { upsert: true, new: true }
            );
            cache.set(key, { value: doc.value, time: Date.now() });
        } catch (err) {
            console.error(`[SettingsService] Error setting key "${key}":`, err);
            throw err;
        }
    }

    /**
     * Get multiple settings at once.
     * @returns {Promise<object>}
     */
    async getAll() {
        try {
            const docs = await Config.find({});
            const settings = {};
            docs.forEach(doc => {
                settings[doc.key] = doc.value;
            });
            return settings;
        } catch (err) {
            console.error('[SettingsService] Error getting all settings:', err);
            return {};
        }
    }
}

module.exports = new SettingsService();
