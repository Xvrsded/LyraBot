class BehaviorCache {
    constructor() {
        // Map of guildId -> { channels: Map, categories: Map, roles: Map }
        this.cache = new Map();
    }

    _ensureGuild(guildId) {
        if (!this.cache.has(guildId)) {
            this.cache.set(guildId, {
                channels: new Map(),
                categories: new Map(),
                roles: new Map()
            });
        }
        return this.cache.get(guildId);
    }

    setChannel(guildId, behaviorId, channelId) {
        this._ensureGuild(guildId).channels.set(behaviorId, channelId);
    }

    getChannel(guildId, behaviorId) {
        return this._ensureGuild(guildId).channels.get(behaviorId);
    }

    setCategory(guildId, behaviorId, categoryId) {
        this._ensureGuild(guildId).categories.set(behaviorId, categoryId);
    }

    getCategory(guildId, behaviorId) {
        return this._ensureGuild(guildId).categories.get(behaviorId);
    }

    setRole(guildId, behaviorId, roleId) {
        this._ensureGuild(guildId).roles.set(behaviorId, roleId);
    }

    getRole(guildId, behaviorId) {
        return this._ensureGuild(guildId).roles.get(behaviorId);
    }

    clearGuild(guildId) {
        this.cache.delete(guildId);
    }

    loadFromState(state) {
        if (!state) return;
        const guildData = this._ensureGuild(state.guildId);
        
        if (state.channels) {
            for (const [k, v] of state.channels.entries()) guildData.channels.set(k, v);
        }
        if (state.categories) {
            for (const [k, v] of state.categories.entries()) guildData.categories.set(k, v);
        }
        if (state.roles) {
            for (const [k, v] of state.roles.entries()) guildData.roles.set(k, v);
        }
    }
}

module.exports = new BehaviorCache();
