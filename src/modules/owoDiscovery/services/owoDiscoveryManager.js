const eventBus = require('../../../services/eventBus');
const channelDiscovery = require('./channelDiscovery');
const roleDiscovery = require('./roleDiscovery');
const configMapper = require('./configMapper');
const migrationDetector = require('./migrationDetector');
const healthScanner = require('./healthScanner');
const logger = require('../../../utils/logger');

class OwODiscoveryManager {
    constructor() {
        this.initialized = false;
    }

    init(client) {
        if (this.initialized) return;
        logger.info('[OwODiscovery] Initializing Enterprise OwO Auto Discovery & Configuration...');

        this._registerEventHooks(client);

        this.initialized = true;
        logger.info('[OwODiscovery] Framework Initialized.');
    }

    _registerEventHooks(client) {
        // Setup Completed
        eventBus.subscribe('setup.completed', async ({ guildId }) => {
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (guild) {
                await this.scanFull(guild);
                eventBus.emit('owo.discovery.completed', { guildId });
            }
        });

        // Channel Events
        client.on('channelCreate', async (channel) => {
            if (channel.type === 0 && channel.guild) {
                await channelDiscovery.evaluateChannel(channel);
            }
        });

        client.on('channelUpdate', async (oldChannel, newChannel) => {
            if (newChannel.type === 0 && newChannel.guild && oldChannel.name !== newChannel.name) {
                await channelDiscovery.evaluateChannel(newChannel);
            }
        });

        client.on('channelDelete', async (channel) => {
            if (channel.guild) {
                // Determine if this channel was mapped and unmap it
                for (const item of channelDiscovery.channelPatterns) {
                    if (item.pattern.test(channel.name)) {
                        await configMapper.unmap(channel.guild.id, item.key);
                    }
                }
            }
        });

        // Role Events
        client.on('roleCreate', async (role) => {
            if (role.guild) await roleDiscovery.evaluateRole(role);
        });

        client.on('roleUpdate', async (oldRole, newRole) => {
            if (newRole.guild && oldRole.name !== newRole.name) {
                await roleDiscovery.evaluateRole(newRole);
            }
        });

        client.on('roleDelete', async (role) => {
            if (role.guild) {
                for (const item of roleDiscovery.rolePatterns) {
                    if (item.pattern.test(role.name)) {
                        await configMapper.unmap(role.guild.id, item.key);
                    }
                }
            }
        });
    }

    async scanFull(guild) {
        if (!guild) return;
        logger.info(`[OwODiscovery] Running full scan on guild ${guild.id}...`);
        
        await migrationDetector.detect(guild); // Will scan internally if not migrated
        
        // Force scan regardless of migration status for fresh setup
        await channelDiscovery.scanGuild(guild);
        await roleDiscovery.scanGuild(guild);
        
        await healthScanner.scan(guild);
    }

    getPluginApi() {
        return {
            discover: async (guild) => this.scanFull(guild),
            scan: async (guild) => healthScanner.scan(guild),
            getHealth: async (guild) => (await healthScanner.scan(guild)).healthScore
        };
    }
}

module.exports = new OwODiscoveryManager();
