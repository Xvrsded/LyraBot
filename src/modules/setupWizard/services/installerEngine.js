const eventBus = require('../../../services/eventBus');
const rollbackService = require('./rollbackService');
const logger = require('../../../utils/logger');
const templateRegistry = require('../registry/templateRegistry');

class InstallerEngine {
    constructor() {
        this.dependencyGraph = [
            'Permission Check',
            'Create Roles',
            'Create Categories',
            'Create Channels',
            'Apply Permissions',
            'Discovery Scan',
            'Behavior Mapping',
            'Configuration Center',
            'Control Center',
            'Admin Panel',
            'Dashboard',
            'Automation',
            'Notification',
            'Health Check',
            'Finish'
        ];
    }

    async run(state, persistenceService, client) {
        if (state.status !== 'running') {
            state.status = 'running';
            await persistenceService.saveState(state);
            eventBus.emit('setup.started', { guildId: state.guildId });
        }

        try {
            const totalSteps = this.dependencyGraph.length;
            const startIndex = Math.floor((state.progress / 100) * totalSteps);
            const template = templateRegistry.getTemplate(state.selectedTemplate);
            const guild = client ? client.guilds.cache.get(state.guildId) : null;

            for (let i = startIndex; i < totalSteps; i++) {
                const taskName = this.dependencyGraph[i];
                logger.info(`[SetupWizard] Running task: ${taskName}`);

                // Execute task physically
                await this._executeTask(taskName, state, template, guild);

                // Update progress
                state.progress = Math.floor(((i + 1) / totalSteps) * 100);
                await persistenceService.saveState(state);

                eventBus.emit('setup.progress', { guildId: state.guildId, progress: state.progress, task: taskName });
            }

            state.status = 'completed';
            state.currentStep = 5;
            await persistenceService.saveState(state);
            eventBus.emit('setup.completed', { guildId: state.guildId });

        } catch (error) {
            logger.error(`[SetupWizard] Installation failed:`, error);
            state.status = 'failed';
            await persistenceService.saveState(state);
            eventBus.emit('setup.failed', { guildId: state.guildId, error: error.message });
            throw error;
        }
    }

    async _executeTask(taskName, state, template, guild) {
        if (!guild) {
            throw new Error('Guild undefined: Cannot execute installer engine without a valid Discord Guild in production.');
        }

        const { ChannelType } = require('discord.js');

        if (taskName === 'Create Categories' && template.categories > 0) {
            // Check if OWO AREA category exists
            const existingCat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '🎮 OWO AREA');
            if (!existingCat) {
                const cat = await guild.channels.create({
                    name: '🎮 OWO AREA',
                    type: ChannelType.GuildCategory
                }).catch(() => null);
                if (cat) state.rollbackData.categories.push(cat.id);
            }
        }
        else if (taskName === 'Create Channels' && template.channels > 0) {
            const cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '🎮 OWO AREA');
            if (cat) {
                const channelsToCreate = ['owo-hunt-battle', 'owo-spam', 'owo-zoo', 'owo-casino'];
                for (const chName of channelsToCreate) {
                    const exists = guild.channels.cache.find(c => c.name === chName && c.parentId === cat.id);
                    if (!exists) {
                        const ch = await guild.channels.create({
                            name: chName,
                            type: ChannelType.GuildText,
                            parent: cat.id
                        }).catch(() => null);
                        if (ch) state.rollbackData.channels.push(ch.id);
                    }
                }
            }
        }
        else if (taskName === 'Admin Panel') {
            const panelInstaller = require('../../adminPanel/services/panelInstaller');
            await panelInstaller.install(guild, state.selectedTemplate);
        }
        else if (taskName === 'Configuration Center') {
            const configCenterManager = require('../../configurationCenter/services/configCenterManager');
            // Ensure config center default configurations are set
            await configCenterManager.set(guild.id, 'owo.enabled', true);
            // Ignore general admin channels by default to prevent OwO spam
            const adminPanel = guild.channels.cache.find(c => c.name === 'admin-panel');
            if (adminPanel) {
                await configCenterManager.set(guild.id, 'owo.ignoredChannels', [adminPanel.id]);
            }
        }
        else {
            // Other tasks delay for visualization
            return new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    async cancel(state, persistenceService) {
        await rollbackService.rollback(state);
        await persistenceService.saveState(state);
        eventBus.emit('setup.cancelled', { guildId: state.guildId });
    }
}

module.exports = new InstallerEngine();
