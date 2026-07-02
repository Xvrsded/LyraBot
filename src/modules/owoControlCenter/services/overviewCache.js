class OverviewCache {
    constructor() {
        this.cache = new Map();
        this.ttl = 10000; // 10 seconds default
    }

    setTTL(ms) {
        this.ttl = ms;
    }

    get(guildId, key) {
        const fullKey = `${guildId}:${key}`;
        if (!this.cache.has(fullKey)) return null;

        const data = this.cache.get(fullKey);
        if (Date.now() - data.timestamp > this.ttl) {
            this.cache.delete(fullKey);
            return null;
        }

        return data.value;
    }

    set(guildId, key, value) {
        const fullKey = `${guildId}:${key}`;
        this.cache.set(fullKey, { value, timestamp: Date.now() });
    }

    clear(guildId) {
        for (const k of this.cache.keys()) {
            if (k.startsWith(`${guildId}:`)) {
                this.cache.delete(k);
            }
        }
    }
}

module.exports = new OverviewCache();
