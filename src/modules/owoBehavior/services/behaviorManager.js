const eventBus = require('../../../services/eventBus');
const behaviorRecovery = require('./behaviorRecovery');
const behaviorValidator = require('./behaviorValidator');
const logger = require('../../../utils/logger');

class BehaviorManager {
    constructor() {
        this.initialized = false;
    }

    init(client) {
        if (this.initialized) return;
        logger.info('[OwOBehavior] Initializing Enterprise OwO Channel Behavior Mapping...');

        this._registerEventHooks(client);

        this.initialized = true;
        logger.info('[OwOBehavior] Framework Initialized.');
    }

    _registerEventHooks(client) {
        // Setup Completed
        eventBus.subscribe('setup.completed', async ({ guildId }) => {
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (guild) {
                await behaviorRecovery.recoverGuild(guild);
            }
        });

        // Channel Events
        client.on('channelCreate', async (channel) => {
            if (channel.guild) {
                if (channel.type === 4) await behaviorValidator.validateCategory(channel);
                else await behaviorValidator.validateChannel(channel);
            }
        });

        client.on('channelUpdate', async (oldChannel, newChannel) => {
            if (newChannel.guild && oldChannel.name !== newChannel.name) {
                if (newChannel.type === 4) await behaviorValidator.validateCategory(newChannel);
                else await behaviorValidator.validateChannel(newChannel);
            }
        });

        client.on('channelDelete', async (channel) => {
            if (channel.guild) await behaviorValidator.handleChannelDelete(channel);
        });

        // Role Events
        client.on('roleCreate', async (role) => {
            if (role.guild) await behaviorValidator.validateRole(role);
        });

        client.on('roleUpdate', async (oldRole, newRole) => {
            if (newRole.guild && oldRole.name !== newRole.name) {
                await behaviorValidator.validateRole(newRole);
            }
        });

        client.on('roleDelete', async (role) => {
            if (role.guild) await behaviorValidator.handleRoleDelete(role);
        });
    }

    getPluginApi() {
        return {
            recover: async (guild) => behaviorRecovery.recoverGuild(guild),
            validateChannel: async (channel) => behaviorValidator.validateChannel(channel),
            validateCategory: async (category) => behaviorValidator.validateCategory(category),
            validateRole: async (role) => behaviorValidator.validateRole(role)
        };
    }
}

module.exports = new BehaviorManager();
