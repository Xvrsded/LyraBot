const sessionManager = require('./sessionManager');
const renderer = require('./renderer');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');

class NavigationManager {
    /**
     * Opens a new session for a user.
     */
    async open(interaction, newPanelId, newPageId = 'index', contextData = {}) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ flags: 64 }).catch(() => {});
            }

            const { guildId, channelId, user } = interaction;

            const session = sessionManager.setSession(guildId, channelId, user.id, newPanelId, newPageId, contextData);

            eventBus.emit('ui.open', {
                userId: user.id,
                panelId: newPanelId,
                pageId: newPageId
            });

            await renderer.render(interaction, session, true); // true = isNewSession
        } catch (error) {
            logger.error('[UI NavigationManager] Open error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Internal Navigation Error', ephemeral: true }).catch(() => {});
            }
        }
    }

    /**
     * Navigates to a specific panel and page in an existing session.
     */
    async navigate(interaction, newPanelId, newPageId = 'index', contextData = {}) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferUpdate().catch(() => {});
            }

            const { guildId, channelId, user } = interaction;

            const session = sessionManager.navigate(guildId, channelId, user.id, newPanelId, newPageId);
            if (!session) {
                const msg = { content: 'Session expired or not found.', ephemeral: true };
                return interaction.deferred || interaction.replied ? interaction.followUp(msg).catch(()=>{}) : interaction.reply(msg).catch(()=>{});
            }

            session.data = { ...session.data, ...contextData };

            eventBus.emit('ui.navigate', {
                userId: user.id,
                panelId: newPanelId,
                pageId: newPageId
            });

            await renderer.render(interaction, session);
        } catch (error) {
            logger.error('[UI NavigationManager] Navigate error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Internal Navigation Error', ephemeral: true }).catch(() => {});
            }
        }
    }

    /**
     * Navigates back one step in history.
     */
    async goBack(interaction) {
        try {
            const { guildId, channelId, user } = interaction;

            const session = sessionManager.goBack(guildId, channelId, user.id);
            if (!session) {
                const msg = { content: 'No history to go back to, or session expired.', ephemeral: true };
                return interaction.deferred || interaction.replied ? interaction.followUp(msg).catch(()=>{}) : interaction.reply(msg).catch(()=>{});
            }

            eventBus.emit('ui.navigate.back', {
                userId: user.id,
                panelId: session.panelId,
                pageId: session.pageId
            });

            await renderer.render(interaction, session);
        } catch (error) {
            logger.error('[UI NavigationManager] GoBack error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Internal Navigation Error', ephemeral: true }).catch(() => {});
            }
        }
    }

    /**
     * Goes to the home/index page of the current panel, or completely resets.
     */
    async goHome(interaction) {
        try {
            const { guildId, channelId, user } = interaction;

            const session = sessionManager.getSession(guildId, channelId, user.id);
            if (!session) {
                const msg = { content: 'Session expired.', ephemeral: true };
                return interaction.deferred || interaction.replied ? interaction.followUp(msg).catch(()=>{}) : interaction.reply(msg).catch(()=>{});
            }

            return this.navigate(interaction, session.panelId, 'index');
        } catch (error) {
            logger.error('[UI NavigationManager] GoHome error:', error);
        }
    }
}

module.exports = new NavigationManager();
