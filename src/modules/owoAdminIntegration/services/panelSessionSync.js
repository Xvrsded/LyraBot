const PersistentPanel = require('../models/PersistentPanel');
const panelRenderer = require('./panelRenderer');
const logger = require('../../../utils/logger');
// Simulating SessionManager from UI Framework (Module 19.1)
const sessionCache = new Map(); 

class PanelSessionSync {
    async handleInteraction(interaction) {
        if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
        
        const guildId = interaction.guild.id;
        const panel = await PersistentPanel.findOne({ guildId });
        if (!panel) return;

        // Ensure this interaction is from our admin panel message
        if (interaction.message.id !== panel.messageId) return;

        const customId = interaction.customId;
        
        if (interaction.isStringSelectMenu() && customId === 'admin_panel_nav') {
            const pageId = interaction.values[0];
            sessionCache.set(guildId, pageId);
            
            const payload = await panelRenderer.renderPage(guildId, pageId);
            await interaction.update(payload);
            logger.info(`[PanelSessionSync] Navigated to ${pageId} in guild ${guildId}`);
        } else if (interaction.isButton() && customId === 'panel_refresh') {
            const currentPage = sessionCache.get(guildId) || 'overview';
            const payload = await panelRenderer.renderPage(guildId, currentPage);
            await interaction.update(payload);
            logger.info(`[PanelSessionSync] Refreshed ${currentPage} in guild ${guildId}`);
        }
    }

    getCurrentPage(guildId) {
        return sessionCache.get(guildId) || 'overview';
    }
}

module.exports = new PanelSessionSync();
