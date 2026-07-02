const uiManager = require('../services/uiManager');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');

/**
 * Handles interactions meant for the UI framework.
 * customId format: ui:<panelId>:<action>:<payload>
 * 
 * Actions:
 * - nav: page navigation
 * - back: go to previous page in history
 * - close: close session
 * - action: trigger custom action in panel/page
 */
class UIRouter {
    async handleInteraction(interaction) {
        if (!interaction.customId || !interaction.customId.startsWith('ui:')) return false;

        const parts = interaction.customId.split(':');
        // parts = ["ui", panelId, action, ...payload]
        if (parts.length < 3) return false;

        const panelId = parts[1];
        const action = parts[2];
        const payload = parts.slice(3).join(':');

        try {
            if (interaction.isButton()) {
                eventBus.emit('ui.button.click', { customId: interaction.customId, userId: interaction.user.id });
            } else if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isMentionableSelectMenu()) {
                const sessionManager = require('../services/sessionManager');
                const session = sessionManager.getSession(interaction.guildId, interaction.channelId, interaction.user.id);
                if (session && payload) {
                    // Extract variable name from payload (e.g. ui:panel:action:selectedTemplate -> selectedTemplate)
                    // If it's a single value array, unpack it for easier use, except if the select menu maxValues > 1
                    // Actually, let's just store the array if it's multiple, or single value if array length is 1
                    session.data[payload] = interaction.values.length === 1 ? interaction.values[0] : interaction.values;
                }
                eventBus.emit('ui.select.change', { customId: interaction.customId, userId: interaction.user.id, values: interaction.values });
            } else if (interaction.isModalSubmit()) {
                eventBus.emit('ui.modal.submit', { customId: interaction.customId, userId: interaction.user.id });
            }

            // Built-in Navigation Handling
            switch (action) {
                case 'open':
                    await uiManager.navigation.open(interaction, panelId, payload || 'index');
                    return true;
                case 'nav':
                    // e.g., ui:economy:nav:wallet
                    await uiManager.navigation.navigate(interaction, panelId, payload);
                    return true;
                
                case 'back':
                    await uiManager.navigation.goBack(interaction);
                    return true;
                
                case 'home':
                    await uiManager.navigation.goHome(interaction);
                    return true;
                
                case 'close':
                    await uiManager.close(interaction);
                    return true;
                
                case 'action':
                    // This could trigger a custom method on the page if we want to add page.onAction
                    // For now, emit event for plugins to catch
                    eventBus.emit(`ui.action.${panelId}.${payload}`, { interaction, payload });
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.deferUpdate().catch(() => {});
                    }
                    return true;
                
                default:
                    logger.warn(`[UI Router] Unknown action: ${action}`);
                    return true;
            }
        } catch (error) {
            logger.error('[UI Router] Routing error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'UI Router Error.', ephemeral: true }).catch(() => {});
            }
            return true;
        }
    }
}

module.exports = new UIRouter();
