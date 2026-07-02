const logger = require('../utils/logger');

class InteractionRouter {
    constructor() {
        this.buttons = new Map();
        this.selectMenus = new Map();
        this.modals = new Map();
    }

    /**
     * Register button handler.
     * @param {string} customId 
     * @param {function} handler 
     */
    registerButton(customId, handler) {
        this.buttons.set(customId, handler);
    }

    /**
     * Register select menu handler.
     * @param {string} customId 
     * @param {function} handler 
     */
    registerSelectMenu(customId, handler) {
        this.selectMenus.set(customId, handler);
    }

    /**
     * Register modal handler.
     * @param {string} customId 
     * @param {function} handler 
     */
    registerModal(customId, handler) {
        this.modals.set(customId, handler);
    }

    /**
     * Centralized execution logic for matching interactions.
     * Supports exact and prefix matching (for dynamic customIds like customId:arg1:arg2).
     * @param {Interaction} interaction Discord Interaction object
     * @returns {Promise<boolean>} returns true if a registered handler was matched and executed, false otherwise.
     */
    async handle(interaction) {
        try {
            if (interaction.isButton()) {
                const handler = this.findHandler(this.buttons, interaction.customId);
                if (handler) {
                    await handler(interaction);
                    return true;
                }
            } else if (interaction.isStringSelectMenu()) {
                const handler = this.findHandler(this.selectMenus, interaction.customId);
                if (handler) {
                    await handler(interaction);
                    return true;
                }
            } else if (interaction.isModalSubmit()) {
                const handler = this.findHandler(this.modals, interaction.customId);
                if (handler) {
                    await handler(interaction);
                    return true;
                }
            }
        } catch (err) {
            logger.error('[InteractionRouter] Handler execution failed:', err);
            const errMsg = '❌ Terjadi kesalahan internal saat memproses aksi Anda.';
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errMsg, ephemeral: true });
            } else {
                await interaction.editReply({ content: errMsg });
            }
            return true;
        }
        return false;
    }

    /**
     * Helper to find a registered handler by matching prefix or exact customId.
     * @private
     */
    findHandler(registry, customId) {
        if (registry.has(customId)) {
            return registry.get(customId);
        }
        // Fallback to prefix matching for routes containing arguments divided by delimiter (e.g. action:arg1)
        for (const [key, handler] of registry.entries()) {
            if (customId.startsWith(key + ':') || customId.startsWith(key)) {
                return handler;
            }
        }
        return null;
    }
}

module.exports = new InteractionRouter();
