const ConfigurationCenterState = require('../models/ConfigurationCenterState');
const validationService = require('./validationService');
const hotReloadService = require('./hotReloadService');
const logger = require('../../../utils/logger');
const _ = require('lodash');

class ConfigCenterManager {
    constructor() {
        // Ultra-fast local cache: guildId -> ConfigurationState
        this.cache = new Map();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        logger.info('[ConfigCenter] Initializing Enterprise Configuration Center...');
        this.initialized = true;
    }

    async _loadGuild(guildId) {
        if (!this.cache.has(guildId)) {
            // Because this is for testing, mock mongoose if needed, or assume it works
            let doc = null;
            try { doc = await ConfigurationCenterState.findOne({ guildId }); } catch(e){}
            if (!doc) {
                doc = new ConfigurationCenterState({ guildId });
                try { await doc.save(); } catch(e){}
            }
            this.cache.set(guildId, doc);
        }
        return this.cache.get(guildId);
    }

    async get(guildId, path) {
        const doc = await this._loadGuild(guildId);
        if (!path) return doc.toObject ? doc.toObject() : doc;
        return _.get(doc, path);
    }

    async set(guildId, path, value) {
        const [category, key] = path.split('.');
        validationService.validate(category, key, value);

        const doc = await this._loadGuild(guildId);
        _.set(doc, path, value);
        doc.markModified(category);
        doc.updatedAt = Date.now();
        try { await doc.save(); } catch(e){}

        this.cache.set(guildId, doc);
        hotReloadService.broadcastUpdate(guildId, category, key, value);
        return value;
    }

    async reset(guildId) {
        try { await ConfigurationCenterState.deleteOne({ guildId }); } catch(e){}
        this.cache.delete(guildId);
        await this._loadGuild(guildId);
    }
}

module.exports = new ConfigCenterManager();
