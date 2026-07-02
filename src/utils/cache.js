const { Collection } = require('discord.js');

class CacheProvider {
    constructor() {
        this.cache = new Collection();
    }

    /**
     * Get a value from the cache.
     * @param {string} key 
     * @returns {any}
     */
    get(key) {
        return this.cache.get(key);
    }

    /**
     * Set a value in the cache.
     * @param {string} key 
     * @param {any} value 
     * @param {number} [ttl] Time to live in milliseconds (optional)
     */
    set(key, value, ttl) {
        this.cache.set(key, value);
        if (ttl) {
            setTimeout(() => {
                this.cache.delete(key);
            }, ttl);
        }
    }

    /**
     * Check if a key exists in the cache.
     * @param {string} key 
     * @returns {boolean}
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Delete a key from the cache.
     * @param {string} key 
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all cache.
     */
    clear() {
        this.cache.clear();
    }
}

module.exports = new CacheProvider();
