const uiManager = require('../../ui/services/uiManager');
const pageManager = require('../../ui/services/pageManager');
const adminPanelManager = require('./adminPanelManager');
const pluginContext = require('../../../services/pluginContext');
const eventBus = require('../../../services/eventBus');

class RuntimeWiring {
    init(client, pluginCtx) {
        // Handle Setup Wizard installation trigger
        eventBus.subscribe('ui.action.setup.start_install', async ({ interaction, payload }) => {
            const sessionManager = require('../../ui/services/sessionManager');
            const session = sessionManager.getSession(interaction.guildId, interaction.channelId, interaction.user.id);
            if (session) {
                // Initialize installation state
                session.data.status = 'running';
                session.data.progress = 0;
                
                // Navigate to install page
                await uiManager.navigation.navigate(interaction, 'setup', 'install');
                
                // Start installer engine in the background
                const installerEngine = require('../../setupWizard/services/installerEngine');
                const persistenceService = require('../../setupWizard/services/persistenceService');
                
                // We mock state object expected by installerEngine
                const installState = {
                    guildId: interaction.guildId,
                    status: 'running',
                    progress: 0,
                    selectedTemplate: session.data.selectedTemplate || 'default',
                    rollbackData: { categories: [], channels: [], roles: [] }
                };
                
                installerEngine.run(installState, persistenceService, client).then(async () => {
                    session.data.status = installState.status;
                    session.data.progress = 100;
                    // Auto-refresh the page if the user is still on it
                    // In a real app we'd emit an event, but here we can just update the UI if interaction is still valid,
                    // or let the user click "Refresh". We'll just emit an event.
                }).catch((err) => {
                    session.data.status = 'failed';
                    console.error('Install failed:', err);
                });
            }
        });

        eventBus.subscribe('ui.action.setup.cancel_install', async ({ interaction, payload }) => {
            const sessionManager = require('../../ui/services/sessionManager');
            const session = sessionManager.getSession(interaction.guildId, interaction.channelId, interaction.user.id);
            if (session) {
                // Just close the session, installation is stopped/rolled back natively in background if needed
                await uiManager.close(interaction);
            }
        });

        // Wire Master Overview
        uiManager.registerPanel({
            id: 'overview',
            title: 'Overview',
            icon: '📊',
            permissions: ['ADMINISTRATOR'],
            pages: ['index']
        });
        pageManager.registerPage('overview', {
            id: 'index',
            render: async (sessionData, interaction) => {
                const MasterOverviewPage = require('./../pages/MasterOverviewPage');
                return await MasterOverviewPage.render(interaction.guildId, interaction.guild);
            }
        });

        // Wire OwO Configuration (Module 22.4)
        uiManager.registerPanel({
            id: 'owo',
            title: 'OwO Configuration',
            icon: '🐶',
            permissions: ['ADMINISTRATOR'],
            pages: ['index']
        });
        pageManager.registerPage('owo', {
            id: 'index',
            render: async (sessionData, interaction) => {
                return await pluginCtx.owoConfiguration.renderOverview(interaction.guildId);
            }
        });

        // Wire Parser Configuration
        uiManager.registerPanel({
            id: 'parser',
            title: 'Parser Configuration',
            icon: '🔍',
            permissions: ['ADMINISTRATOR'],
            pages: ['index']
        });
        pageManager.registerPage('parser', {
            id: 'index',
            render: async (sessionData, interaction) => {
                return await pluginCtx.owoConfiguration.renderParser(interaction.guildId);
            }
        });

        // Wire Health Configuration
        uiManager.registerPanel({
            id: 'health',
            title: 'System Health',
            icon: '🩺',
            permissions: ['ADMINISTRATOR'],
            pages: ['index']
        });
        pageManager.registerPage('health', {
            id: 'index',
            render: async (sessionData, interaction) => {
                return await pluginCtx.owoConfiguration.renderHealth(interaction.guildId);
            }
        });

        // Wire Leveling Configuration (Module 22.5)
        uiManager.registerPanel({
            id: 'leveling',
            title: 'Leveling Configuration',
            icon: '⭐',
            permissions: ['ADMINISTRATOR'],
            pages: ['index']
        });
        pageManager.registerPage('leveling', {
            id: 'index',
            render: async (sessionData, interaction) => {
                return await pluginCtx.levelingConfiguration.renderOverview(interaction.guildId);
            }
        });

        // Wire Dashboard
        uiManager.registerPanel({
            id: 'dashboard',
            title: 'Dashboard',
            icon: '📊',
            permissions: ['ADMINISTRATOR'],
            pages: ['index']
        });
        pageManager.registerPage('dashboard', {
            id: 'index',
            render: async (sessionData, interaction) => {
                const { EmbedBuilder } = require('discord.js');
                const widgets = pluginCtx.dashboard ? 'Loaded' : 'Offline';
                const embed = new EmbedBuilder()
                    .setTitle('📊 Enterprise Dashboard')
                    .setDescription('Welcome to the Dashboard Runtime.')
                    .addFields({ name: 'Status', value: `Dashboard Module: ${widgets}` })
                    .setColor('#00ff00');
                return { embeds: [embed], components: [] };
            }
        });

        // Wire Setup Wizard
        uiManager.registerPanel({
            id: 'setup',
            title: 'Setup Wizard',
            icon: '⚙️',
            permissions: ['ADMINISTRATOR'],
            pages: ['index', 'template', 'configuration', 'preview', 'install']
        });
        
        pageManager.registerPage('setup', {
            id: 'index',
            render: async (sessionData, interaction) => {
                const WelcomePage = require('../../setupWizard/pages/WelcomePage');
                const validationService = require('../../setupWizard/services/validationService');
                const validationStatus = validationService.validatePermissions(interaction.guild);
                return WelcomePage.render(validationStatus);
            }
        });
        pageManager.registerPage('setup', {
            id: 'template',
            render: async (sessionData, interaction) => {
                const TemplateSelectionPage = require('../../setupWizard/pages/TemplateSelectionPage');
                return TemplateSelectionPage.render();
            }
        });
        pageManager.registerPage('setup', {
            id: 'configuration',
            render: async (sessionData, interaction) => {
                const ConfigurationPage = require('../../setupWizard/pages/ConfigurationPage');
                return ConfigurationPage.render(sessionData);
            }
        });
        pageManager.registerPage('setup', {
            id: 'preview',
            render: async (sessionData, interaction) => {
                const PreviewPage = require('../../setupWizard/pages/PreviewPage');
                return PreviewPage.render(sessionData);
            }
        });
        pageManager.registerPage('setup', {
            id: 'install',
            render: async (sessionData, interaction) => {
                const InstallProgressPage = require('../../setupWizard/pages/InstallProgressPage');
                return InstallProgressPage.render(sessionData);
            }
        });
        
        // Wire Configuration Center
        uiManager.registerPanel({
            id: 'configuration',
            title: 'Configuration Center',
            icon: '🔧',
            permissions: ['ADMINISTRATOR'],
            pages: ['index']
        });
        pageManager.registerPage('configuration', {
            id: 'index',
            render: async (sessionData, interaction) => {
                const OverviewPage = require('../../configurationCenter/pages/OverviewPage');
                return OverviewPage.render({ guildId: interaction.guildId, guild: interaction.guild });
            }
        });

        // Wire The Remaining 13 Modules
        const pagesToWire = [
            { id: 'economy', title: 'Economy Engine', icon: '💰', page: 'EconomyPage' },
            { id: 'inventory', title: 'Inventory Engine', icon: '🎒', page: 'InventoryPage' },
            { id: 'marketplace', title: 'Marketplace Engine', icon: '🏪', page: 'MarketplacePage' },
            { id: 'quest', title: 'Quest Engine', icon: '📜', page: 'QuestPage' },
            { id: 'achievement', title: 'Achievement Engine', icon: '🏆', page: 'AchievementPage' },
            { id: 'moderation', title: 'Moderation Engine', icon: '🛡️', page: 'ModerationPage' },
            { id: 'statistics', title: 'Statistics Engine', icon: '📈', page: 'StatisticsPage' },
            { id: 'discovery', title: 'Discovery Runtime', icon: '📡', page: 'DiscoveryPage' },
            { id: 'automation', title: 'Automation Runtime', icon: '⚙️', page: 'AutomationPage' },
            { id: 'behavior', title: 'Behavior Runtime', icon: '🤖', page: 'BehaviorPage' },
            { id: 'decision', title: 'Decision Engine', icon: '🧠', page: 'DecisionPage' },
            { id: 'channel-mapping', title: 'Channel Mapping', icon: '🗺️', page: 'ChannelMappingPage' },
            { id: 'gameplay', title: 'Gameplay Engine', icon: '🎮', page: 'GameplayPage' }
        ];

        for (const w of pagesToWire) {
            uiManager.registerPanel({
                id: w.id,
                title: w.title,
                icon: w.icon,
                permissions: ['ADMINISTRATOR'],
                pages: ['index']
            });
            pageManager.registerPage(w.id, {
                id: 'index',
                render: async (sessionData, interaction) => {
                    const PageClass = require('./../pages/' + w.page);
                    return await PageClass.render(interaction.guildId, interaction.guild, pluginCtx);
                }
            });
        }
    }
}

module.exports = new RuntimeWiring();
