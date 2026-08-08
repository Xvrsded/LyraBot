const GuildConfig = require('../models/GuildConfig');
const StoreSetting = require('../models/StoreSetting');
const RobuxPackage = require('../models/RobuxPackage');
const MMFee = require('../models/MMFee');
const auditService = require('./auditService');
const cacheProvider = require('../utils/cache');
const logger = require('../utils/logger');

// Dashboard Config Cache Placeholder (Memory for now, Redis-ready)
const dashboardCache = {
    globalConfig: null,
    packages: {}
};

class ConfigService {
    /**
     * Initialize/create a configuration document for a guild.
     * @param {string} guildId Guild ID string
     * @returns {Promise<Document>}
     */
    async create(guildId) {
        // Query existing legacy configurations if any exist to import them
        const WelcomeConfig = require('../models/WelcomeConfig');
        const LeaveConfig = require('../models/LeaveConfig');

        const [welcomeConfig, leaveConfig] = await Promise.all([
            WelcomeConfig.findOne({ guildId }).lean().catch(() => null),
            LeaveConfig.findOne({ guildId }).lean().catch(() => null)
        ]);

        const welcomeData = {};
        const channelsData = {};

        if (welcomeConfig) {
            welcomeData.enabled = welcomeConfig.enabled;
            if (welcomeConfig.message) welcomeData.message = welcomeConfig.message;
            if (welcomeConfig.welcomeGif) welcomeData.welcomeGif = welcomeConfig.welcomeGif;
            if (welcomeConfig.autoRole) welcomeData.autoRole = welcomeConfig.autoRole;
            if (welcomeConfig.channelId) channelsData.welcome = welcomeConfig.channelId;
        }

        if (leaveConfig) {
            if (leaveConfig.channelId) channelsData.goodbye = leaveConfig.channelId;
        }

        const config = await GuildConfig.create({
            guildId,
            welcome: Object.keys(welcomeData).length > 0 ? welcomeData : undefined,
            channels: Object.keys(channelsData).length > 0 ? channelsData : undefined
        });

        cacheProvider.set(guildId, config);
        logger.info(`[ConfigService] Initialized default GuildConfig for ${guildId} (imported legacy configs)`);
        return config;
    }

    /**
     * Check if configuration document exists in cache or DB.
     * @param {string} guildId Guild ID string
     * @returns {Promise<boolean>}
     */
    async exists(guildId) {
        if (cacheProvider.has(guildId)) return true;
        const count = await GuildConfig.countDocuments({ guildId });
        return count > 0;
    }

    /**
     * Get the GuildConfig document, utilizing cache if hit.
     * @param {string} guildId Guild ID string
     * @returns {Promise<Document>}
     */
    async getConfig(guildId) {
        if (cacheProvider.has(guildId)) {
            return cacheProvider.get(guildId);
        }
        
        let config = await GuildConfig.findOne({ guildId });
        if (!config) {
            config = await this.create(guildId);
        } else {
            cacheProvider.set(guildId, config);
        }
        return config;
    }

    /**
     * Update a specific config path via Mongoose dot notation. Update cache automatically.
     * @param {string} guildId Guild ID string
     * @param {string} path Sub-document path (e.g., 'general.prefix')
     * @param {any} value The new value to store
     * @returns {Promise<Document>}
     */
    async updateConfig(guildId, path, value) {
        const updateQuery = { $set: { [path]: value } };
        const config = await GuildConfig.findOneAndUpdate(
            { guildId },
            updateQuery,
            { new: true, upsert: true }
        );
        cacheProvider.set(guildId, config);
        logger.info(`[ConfigService] Updated Guild ${guildId} config path "${path}" to:`, value);
        return config;
    }

    /**
     * Reset config document to absolute defaults.
     * @param {string} guildId Guild ID string
     * @returns {Promise<Document>}
     */
    async reset(guildId) {
        await GuildConfig.deleteOne({ guildId });
        cacheProvider.delete(guildId);
        const config = await this.create(guildId);
        logger.info(`[ConfigService] Reset configuration to default values for Guild ID: ${guildId}`);
        return config;
    }

    /**
     * Clean up and delete configuration document.
     * @param {string} guildId Guild ID string
     * @returns {Promise<any>}
     */
    async deleteConfig(guildId) {
        const res = await GuildConfig.deleteOne({ guildId });
        cacheProvider.delete(guildId);
        logger.info(`[ConfigService] Deleted configuration document for Guild ID: ${guildId}`);
        return res;
    }

    /**
     * Synchronize DB configurations with all guilds the Discord client is currently in.
     * @param {Client} client Discord Client object
     * @returns {Promise<void>}
     */
    async sync(client) {
        logger.info('[ConfigService] Synchronizing guild configurations...');
        const guilds = client.guilds.cache.keys();
        let createdCount = 0;
        for (const guildId of guilds) {
            const hasConfig = await this.exists(guildId);
            if (!hasConfig) {
                await this.create(guildId);
                createdCount++;
            }
        }
        logger.info(`[ConfigService] Synchronization complete. Registered ${createdCount} missing configs.`);
    }

    /**
     * Expose Cache layer provider.
     * @returns {CacheProvider}
     */
    cache() {
        return cacheProvider;
    }

    // ==========================================
    // DASHBOARD: READERS (Cache-Ready)
    // ==========================================
    
    async getGlobalConfig(forceRefresh = false) {
        if (!forceRefresh && dashboardCache.globalConfig) {
            return dashboardCache.globalConfig;
        }
        let config = await StoreSetting.findOne();
        if (!config) {
            config = await StoreSetting.create({});
        }
        dashboardCache.globalConfig = config;
        return config;
    }

    async getProductPackages(type, forceRefresh = false) {
        if (!forceRefresh && dashboardCache.packages[type]) {
            return dashboardCache.packages[type];
        }
        const typesToFetch = type === 'visend' ? ['visend', 'custom'] : [type];
        const packages = await RobuxPackage.find({ type: { $in: typesToFetch }, isActive: true }).sort({ displayOrder: 1, amount: 1 });
        dashboardCache.packages[type] = packages;
        return packages;
    }

    async getMMFees(forceRefresh = false) {
        if (!forceRefresh && dashboardCache.mmFees) {
            return dashboardCache.mmFees;
        }
        const fees = await MMFee.find({ isActive: true }).sort({ displayOrder: 1, minAmount: 1 });
        dashboardCache.mmFees = fees;
        return fees;
    }

    // ==========================================
    // DASHBOARD: WRITERS & SAFE UPDATE FLOW
    // ==========================================
    
    async updateInventory(type, amount, author = 'System', userId = null) {
        const config = await this.getGlobalConfig(true);
        const oldAmount = type === 'GIG' ? config.gigStock : config.sendStock;
        
        if (type === 'GIG') config.gigStock = amount;
        if (type === 'SEND') config.sendStock = amount;
        
        config.lastUpdatedBy = author;
        config.lastUpdatedAt = new Date();
        config.configVersion += 1;
        
        await config.save();
        dashboardCache.globalConfig = config; // Update cache

        // Audit Logging
        await auditService.info('Dashboard', 'INVENTORY_UPDATE', {
            userId: userId,
            metadata: {
                type,
                oldValue: oldAmount,
                newValue: amount
            }
        });

        // Trigger Sync
        await this._triggerSyncRefreshers();
        return config;
    }

    async updateGlobalRate(rate, author = 'System', userId = null) {
        const config = await this.getGlobalConfig(true);
        const oldRate = config.gigRate;
        
        config.gigRate = rate;
        config.lastUpdatedBy = author;
        config.lastUpdatedAt = new Date();
        config.configVersion += 1;
        
        await config.save();
        dashboardCache.globalConfig = config;

        await auditService.info('Dashboard', 'RATE_UPDATE', {
            userId: userId,
            metadata: {
                oldValue: oldRate,
                newValue: rate
            }
        });

        await this._triggerSyncRefreshers();
        return config;
    }

    async updateProductPackage(packageId, updateData, author = 'System', userId = null) {
        const pkg = await RobuxPackage.findById(packageId);
        if (!pkg) throw new Error('Package not found');

        const oldData = { price: pkg.price, amount: pkg.amount, isActive: pkg.isActive, displayOrder: pkg.displayOrder };
        
        Object.assign(pkg, updateData);
        await pkg.save();

        // Invalidate cache
        delete dashboardCache.packages[pkg.type];
        
        await auditService.info('Dashboard', 'PACKAGE_UPDATE', {
            userId: userId,
            metadata: {
                packageId,
                type: pkg.type,
                oldValue: oldData,
                newValue: updateData
            }
        });

        await this._triggerSyncRefreshers();
        return pkg;
    }

    async createProductPackage(type, data, author = 'System', userId = null) {
        const pkg = await RobuxPackage.findOneAndUpdate(
            { type, amount: data.amount },
            { ...data, type, isActive: true },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        delete dashboardCache.packages[type];
        
        await auditService.info('Dashboard', 'PACKAGE_CREATE', {
            userId: userId,
            metadata: {
                type,
                data
            }
        });

        await this._triggerSyncRefreshers();
        return pkg;
    }

    async updateMMFee(feeId, updateData, author = 'System', userId = null) {
        const fee = await MMFee.findById(feeId);
        if (!fee) throw new Error('MMFee not found');
        
        Object.assign(fee, updateData);
        fee.updatedBy = author;
        fee.updatedAt = new Date();
        await fee.save();

        delete dashboardCache.mmFees;
        
        await auditService.info('Dashboard', 'MMFEE_UPDATE', {
            userId: userId,
            metadata: { feeId, updateData }
        });

        await this._triggerSyncRefreshers();
        return fee;
    }

    async createMMFee(data, author = 'System', userId = null) {
        const fee = await MMFee.create({ ...data, updatedBy: author });
        delete dashboardCache.mmFees;
        
        await auditService.info('Dashboard', 'MMFEE_CREATE', {
            userId: userId,
            metadata: { data }
        });

        await this._triggerSyncRefreshers();
        return fee;
    }

    async toggleMMStatus(status, author = 'System', userId = null) {
        const config = await this.getGlobalConfig(true);
        // Initialize mm_rekber if it doesn't exist
        if (!config.products.mm_rekber) {
            config.products.mm_rekber = { status: 'OPEN' };
        }
        config.products.mm_rekber.status = status;
        config.lastUpdatedBy = author;
        config.lastUpdatedAt = new Date();
        config.configVersion += 1;
        
        await config.save();
        dashboardCache.globalConfig = config;

        await auditService.info('Dashboard', 'MM_STATUS_UPDATE', {
            userId: userId,
            metadata: { status }
        });

        await this._triggerSyncRefreshers();
        return config;
    }

    async toggleLimitedStatus(status, author = 'System', userId = null) {
        const config = await this.getGlobalConfig(true);
        if (!config.products.limited_item) {
            config.products.limited_item = { status: 'OPEN' };
        }
        config.products.limited_item.status = status;
        config.lastUpdatedBy = author;
        config.lastUpdatedAt = new Date();
        config.configVersion += 1;
        
        await config.save();
        dashboardCache.globalConfig = config;

        await auditService.info('Dashboard', 'LIMITED_STATUS_UPDATE', {
            userId: userId,
            metadata: { status }
        });

        await this._triggerSyncRefreshers();
        return config;
    }

    // ==========================================
    // INTERNAL SYNC MECHANISM
    // ==========================================
    
    async _triggerSyncRefreshers() {
        try {
            const eventBus = require('./eventBus');
            eventBus.emit('config.updated', {});
        } catch (err) {
            logger.error('[ConfigService] Failed to trigger sync refreshers:', err);
        }
    }
}

module.exports = new ConfigService();
