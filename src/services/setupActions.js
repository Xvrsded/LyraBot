const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');

class SetupAction {
    /**
     * Base constructor for a setup execution action.
     * @param {string} type Action type identifier (e.g. 'CREATE_ROLE')
     * @param {string} name Display name of the action
     */
    constructor(type, name) {
        this.type = type;
        this.name = name;
        this.status = 'pending'; // pending, running, completed, failed, skipped
        this.result = null;
        this.error = null;
    }

    /**
     * Executes the action against a Discord guild.
     * @param {Guild} guild Discord Guild object
     * @param {object} context Execution context (holds mappings, rollback logs)
     * @returns {Promise<any>}
     */
    async execute(guild, context) {
        throw new Error('Method execute() must be implemented.');
    }
}

class CreateRoleAction extends SetupAction {
    /**
     * Action to create a custom role.
     * @param {object} roleData Role configuration properties
     */
    constructor(roleData) {
        super('CREATE_ROLE', `Role: ${roleData.name}`);
        this.roleData = roleData;
    }

    async execute(guild, context) {
        this.status = 'running';
        
        // Convert permission strings into bitfields
        const permissions = this.roleData.permissions?.map(p => PermissionFlagsBits[p]).filter(Boolean) || [];

        try {
            const role = await guild.roles.create({
                name: this.roleData.name,
                color: this.roleData.color || '#99aab5',
                hoist: !!this.roleData.hoist,
                permissions,
                reason: 'Auto Setup System'
            });

            // Store mapping in context to translate permission overwrites later
            context.roles[this.roleData.name] = role.id;
            context.rollback.roles.push(role.id);

            this.status = 'completed';
            this.result = role.id;
            logger.info(`[SetupExecutor] Role created: "${this.roleData.name}"`);
            return role;
        } catch (err) {
            this.status = 'failed';
            this.error = err.message;
            throw err;
        }
    }
}

class CreateCategoryAction extends SetupAction {
    /**
     * Action to create a channel category.
     * @param {object} catData Category configuration properties
     */
    constructor(catData) {
        super('CREATE_CATEGORY', `Kategori: ${catData.name}`);
        this.catData = catData;
    }

    async execute(guild, context) {
        this.status = 'running';
        try {
            const category = await guild.channels.create({
                name: this.catData.name,
                type: 4, // GuildCategory
                reason: 'Auto Setup System'
            });

            context.categories[this.catData.name] = category.id;
            context.rollback.channels.push(category.id);

            this.status = 'completed';
            this.result = category.id;
            logger.info(`[SetupExecutor] Category created: "${this.catData.name}"`);
            return category;
        } catch (err) {
            this.status = 'failed';
            this.error = err.message;
            throw err;
        }
    }
}

class CreateChannelAction extends SetupAction {
    /**
     * Action to create a text or voice channel.
     * @param {object} chanData Channel configuration properties
     */
    constructor(chanData) {
        super('CREATE_CHANNEL', `Channel: ${chanData.name}`);
        this.chanData = chanData;
    }

    async execute(guild, context) {
        this.status = 'running';
        try {
            const parentId = this.chanData.parent ? context.categories[this.chanData.parent] : null;

            const channel = await guild.channels.create({
                name: this.chanData.name,
                type: this.chanData.type || 0, // GuildText default
                topic: this.chanData.topic || '',
                parent: parentId,
                reason: 'Auto Setup System'
            });

            context.channels[this.chanData.name] = channel.id;
            context.rollback.channels.push(channel.id);

            this.status = 'completed';
            this.result = channel.id;
            logger.info(`[SetupExecutor] Channel created: "${this.chanData.name}"`);
            return channel;
        } catch (err) {
            this.status = 'failed';
            this.error = err.message;
            throw err;
        }
    }
}

class DeleteRoleAction extends SetupAction {
    /**
     * Action to delete an existing role.
     * @param {string} roleId The role ID
     * @param {string} roleName Role name for logs
     */
    constructor(roleId, roleName) {
        super('DELETE_ROLE', `Hapus Role: ${roleName}`);
        this.roleId = roleId;
        this.roleName = roleName;
    }

    async execute(guild, context) {
        this.status = 'running';
        try {
            const role = guild.roles.cache.get(this.roleId);
            if (role && role.editable) {
                await role.delete('Auto Setup Replace Strategy');
            }
            this.status = 'completed';
            logger.info(`[SetupExecutor] Deleted role: "${this.roleName}"`);
        } catch (err) {
            this.status = 'failed';
            this.error = err.message;
            throw err;
        }
    }
}

class DeleteChannelAction extends SetupAction {
    /**
     * Action to delete an existing channel or category.
     * @param {string} channelId The channel ID
     * @param {string} channelName Channel name for logs
     */
    constructor(channelId, channelName) {
        super('DELETE_CHANNEL', `Hapus Channel: ${channelName}`);
        this.channelId = channelId;
        this.channelName = channelName;
    }

    async execute(guild, context) {
        this.status = 'running';
        try {
            const channel = guild.channels.cache.get(this.channelId);
            if (channel && channel.deletable) {
                await channel.delete('Auto Setup Replace Strategy');
            }
            this.status = 'completed';
            logger.info(`[SetupExecutor] Deleted channel: "${this.channelName}"`);
        } catch (err) {
            this.status = 'failed';
            this.error = err.message;
            throw err;
        }
    }
}

class UpdatePermissionsAction extends SetupAction {
    /**
     * Action to apply role/member overrides to channels or categories.
     * @param {string} targetName Name of the channel/category
     * @param {string} targetType 'channel' or 'category'
     * @param {object} overrides Metadata rules for overwrites
     */
    constructor(targetName, targetType, overrides) {
        super('UPDATE_PERMISSIONS', `Izin: ${targetName}`);
        this.targetName = targetName;
        this.targetType = targetType;
        this.overrides = overrides;
    }

    async execute(guild, context) {
        this.status = 'running';
        try {
            const targetId = this.targetType === 'category' ? context.categories[this.targetName] : context.channels[this.targetName];
            const targetChannel = guild.channels.cache.get(targetId);

            if (!targetChannel) {
                throw new Error(`Target channel/kategori "${this.targetName}" tidak ditemukan.`);
            }

            // Build dynamic overwrites
            const permissionOverwrites = [];

            // Apply @everyone deny/allow
            if (this.overrides.isReadonly) {
                permissionOverwrites.push({
                    id: guild.id, // @everyone
                    deny: [PermissionFlagsBits.SendMessages],
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                });

                // Allow admins to send messages
                const adminRoles = ['Owner', 'Developer', 'Server Manager', 'Head Admin', 'Admin'];
                adminRoles.forEach(r => {
                    const roleId = context.roles[r] || guild.roles.cache.find(role => role.name === r)?.id;
                    if (roleId) {
                        permissionOverwrites.push({
                            id: roleId,
                            allow: [PermissionFlagsBits.SendMessages]
                        });
                    }
                });
            } else if (this.overrides.isLogs) {
                permissionOverwrites.push({
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                });

                const staffRoles = ['Owner', 'Developer', 'Server Manager', 'Head Admin', 'Admin', 'Moderator', 'Trial Moderator', 'Support Team', 'Event Team'];
                staffRoles.forEach(r => {
                    const roleId = context.roles[r] || guild.roles.cache.find(role => role.name === r)?.id;
                    if (roleId) {
                        permissionOverwrites.push({
                            id: roleId,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                        });
                    }
                });
            } else if (this.overrides.isStaffChat) {
                permissionOverwrites.push({
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                });

                const staffChatRoles = ['Owner', 'Developer', 'Server Manager', 'Head Admin', 'Admin', 'Moderator'];
                staffChatRoles.forEach(r => {
                    const roleId = context.roles[r] || guild.roles.cache.find(role => role.name === r)?.id;
                    if (roleId) {
                        permissionOverwrites.push({
                            id: roleId,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                        });
                    }
                });
            }

            // If the category itself is staff only
            if (this.targetType === 'category' && this.overrides.isStaffOnly) {
                permissionOverwrites.push({
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                });
                
                const staffRoles = ['Owner', 'Developer', 'Server Manager', 'Head Admin', 'Admin', 'Moderator', 'Trial Moderator', 'Support Team', 'Event Team'];
                staffRoles.forEach(r => {
                    const roleId = context.roles[r] || guild.roles.cache.find(role => role.name === r)?.id;
                    if (roleId) {
                        permissionOverwrites.push({
                            id: roleId,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                        });
                    }
                });
            }

            if (permissionOverwrites.length > 0) {
                await targetChannel.permissionOverwrites.set(permissionOverwrites);
            }

            this.status = 'completed';
            logger.info(`[SetupExecutor] Permissions set for "${this.targetName}"`);
        } catch (err) {
            this.status = 'failed';
            this.error = err.message;
            throw err;
        }
    }
}

class ConfigureDatabaseAction extends SetupAction {
    /**
     * Action to setup MongoDB configurations.
     * @param {string} categoryKey Template category key
     * @param {object} welcomeConfig Welcome configuration fields
     * @param {object} logsConfig Logging configuration fields
     */
    constructor(categoryKey, welcomeConfig, logsConfig) {
        super('CONFIGURE_DATABASE', 'Konfigurasi MongoDB');
        this.categoryKey = categoryKey;
        this.welcomeConfig = welcomeConfig;
        this.logsConfig = logsConfig;
    }

    async execute(guild, context) {
        this.status = 'running';
        try {
            const configService = require('./configService');

            // Log mapping channel
            const logChannelId = context.channels['📜・logs'] || context.channels['🛠️【log-transaksi-product】'] || null;
            if (logChannelId) {
                await configService.updateConfig(guild.id, 'channels.logs', logChannelId);
            }

            this.status = 'completed';
            logger.info(`[SetupExecutor] Database configurations synced for guild ${guild.id}`);
        } catch (err) {
            this.status = 'failed';
            this.error = err.message;
            throw err;
        }
    }
}

module.exports = {
    SetupAction,
    CreateRoleAction,
    CreateCategoryAction,
    CreateChannelAction,
    DeleteRoleAction,
    DeleteChannelAction,
    UpdatePermissionsAction,
    ConfigureDatabaseAction
};
