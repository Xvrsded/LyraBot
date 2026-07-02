const { PermissionFlagsBits } = require('discord.js');
const validators = require('../utils/validators');
const setupPlanner = require('./setupPlanner');
const setupExecutor = require('./setupExecutor');
const templateLoader = require('./templateLoader');
const logger = require('../utils/logger');

class SetupEngine {
    constructor() {
        this.requiredPermissions = [
            PermissionFlagsBits.Administrator,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageWebhooks
        ];
        
        // Plugin actions registry for future expandability
        this.pluginActions = new Map();
    }

    /**
     * Verifies if the bot has all required permissions in the guild.
     * @param {Guild} guild Discord Guild object
     * @returns {{ allowed: boolean, missing: string[] }} Permission check results
     */
    verifyPermissions(guild) {
        const clientMember = guild.members.me;
        if (!clientMember) {
            return { allowed: false, missing: ['Bot Member not found in Guild cache'] };
        }

        const missing = [];
        const permissionNames = {
            [PermissionFlagsBits.Administrator]: 'Administrator',
            [PermissionFlagsBits.ManageChannels]: 'Manage Channels',
            [PermissionFlagsBits.ManageRoles]: 'Manage Roles',
            [PermissionFlagsBits.ManageGuild]: 'Manage Server',
            [PermissionFlagsBits.ManageWebhooks]: 'Manage Webhooks'
        };

        for (const perm of this.requiredPermissions) {
            if (!clientMember.permissions.has(perm)) {
                missing.push(permissionNames[perm] || String(perm));
            }
        }

        return {
            allowed: missing.length === 0,
            missing
        };
    }

    /**
     * Registers a custom setup action type for plugin support.
     * @param {string} type The action type key
     * @param {class} actionClass Concrete class extending SetupAction
     */
    registerActionType(type, actionClass) {
        this.pluginActions.set(type, actionClass);
        logger.info(`[SetupEngine] Registered plugin action type: "${type}"`);
    }

    /**
     * Executes the setup sequence.
     * @param {Guild} guild Discord Guild object
     * @param {string} templateName Template name key
     * @param {string} strategy Conflict strategy ('Skip', 'Replace', 'Merge')
     * @param {object} interaction Discord Interaction object
     * @returns {Promise<{ success: boolean, summary: object, rollbackReport: object|null }>}
     */
    async executeSetup(guild, templateName, strategy, interaction) {
        // 1. Verify Bot Permissions
        const permCheck = this.verifyPermissions(guild);
        if (!permCheck.allowed) {
            throw new Error(`Bot kekurangan izin perizinan berikut di server: **${permCheck.missing.join(', ')}**.`);
        }

        // 2. Load Template
        const template = templateLoader.load(templateName);
        if (!template) {
            throw new Error(`Template "${templateName}" tidak ditemukan atau gagal dikompilasi.`);
        }

        // 3. Generate Plan
        const { plan, context } = setupPlanner.generatePlan(guild, template, strategy);
        if (plan.length === 0) {
            return {
                success: true,
                summary: {
                    setupTime: '0 detik',
                    rolesCreated: 0,
                    categoriesCreated: 0,
                    channelsCreated: 0,
                    objectsDeleted: 0,
                    objectsUpdated: 0,
                    objectsSkipped: template.channels.length + template.roles.length + template.categories.length,
                    errors: [],
                    warnings: ['Tidak ada perubahan yang diperlukan. Seluruh channel dan role sudah sesuai.']
                },
                rollbackReport: null
            };
        }

        // 4. Run Plan via SetupExecutor
        const result = await setupExecutor.execute(guild, plan, context, interaction);

        if (result.success) {
            const eventBus = require('./eventBus');
            eventBus.emit('setup.completed', { guildId: guild.id, templateId: templateName });
        }

        return result;
    }
}

module.exports = new SetupEngine();
