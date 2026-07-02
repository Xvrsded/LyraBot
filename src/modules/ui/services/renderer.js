const panelManager = require('./panelManager');
const pageManager = require('./pageManager');
const logger = require('../../../utils/logger');

class Renderer {
    /**
     * Renders the current session state to the interaction.
     */
    async render(interaction, session, isNewSession = false) {
        if (!session) {
            return this.replyOrEdit(interaction, { content: 'Invalid or expired session.', embeds: [], components: [] }, isNewSession);
        }

        const panel = panelManager.getPanel(session.panelId);
        if (!panel) {
            logger.error(`[UI Renderer] Panel not found: ${session.panelId}`);
            return this.replyOrEdit(interaction, { content: 'Panel configuration missing.', embeds: [], components: [] }, isNewSession);
        }

        const page = pageManager.getPage(session.panelId, session.pageId);
        if (!page) {
            logger.error(`[UI Renderer] Page not found: ${session.panelId}:${session.pageId}`);
            return this.replyOrEdit(interaction, { content: 'Page configuration missing.', embeds: [], components: [] }, isNewSession);
        }

        try {
            // Check permissions here if needed
            // TODO: integrate with identity/permission system
            
            const payload = await page.render(session.data, interaction);
            await this.replyOrEdit(interaction, payload, isNewSession);
        } catch (error) {
            logger.error(`[UI Renderer] Error rendering page ${session.panelId}:${session.pageId}:`, error);
            await this.replyOrEdit(interaction, { content: 'An error occurred while rendering the page.', embeds: [], components: [] }, isNewSession);
        }
    }

    /**
     * Helper to gracefully reply, editReply, or update.
     */
    async replyOrEdit(interaction, payload, isNewSession = false) {
        if (!payload.flags && payload.ephemeral) {
            payload.flags = 64; // Ephemeral flag
        } else if (payload.ephemeral === undefined && !payload.flags) {
            payload.flags = 64; // Default to ephemeral
        }
        delete payload.ephemeral;
        
        if (interaction.isMessageComponent()) {
            if (isNewSession) {
                // If opening a new session from a button, DO NOT update the original message. Reply ephemerally.
                if (interaction.deferred) {
                    await interaction.followUp(payload);
                } else if (!interaction.replied) {
                    await interaction.reply(payload);
                } else {
                    await interaction.followUp(payload);
                }
            } else {
                if (interaction.deferred) {
                    await interaction.editReply(payload);
                } else if (!interaction.replied) {
                    await interaction.update(payload);
                } else {
                    await interaction.editReply(payload);
                }
            }
        } else if (interaction.isCommand() || interaction.isModalSubmit()) {
            if (interaction.deferred) {
                await interaction.editReply(payload);
            } else if (interaction.replied) {
                await interaction.followUp(payload);
            } else {
                await interaction.reply(payload);
            }
        }
    }
}

module.exports = new Renderer();
