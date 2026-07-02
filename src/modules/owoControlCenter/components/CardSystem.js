const logger = require('../../../utils/logger');

class CardSystem {
    /**
     * Renders a standardized card block for an embed.
     * In Discord.js, "Cards" are represented as Fields or separate thin Embeds.
     * We'll return an EmbedBuilder that can be appended to the page.
     * If a renderer fails, it catches and returns a Warning Card.
     */
    async renderCard(title, rendererFn, context = {}) {
        try {
            const data = await rendererFn(context);
            // Returns formatted string for an embed field
            return {
                name: title,
                value: data || 'No data.',
                inline: false
            };
        } catch (error) {
            logger.error(`[CardSystem] Failed to render card ${title}:`, error);
            return {
                name: `⚠ ${title} (Module unavailable)`,
                value: `Error: ${error.message}`,
                inline: false
            };
        }
    }
}

module.exports = new CardSystem();
