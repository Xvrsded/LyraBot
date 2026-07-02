const logger = require('../utils/logger');

class OwOEmbedParser {
    /**
     * Parses a message embed object.
     * @param {Embed} embed Discord Embed object
     * @returns {object|null} Parsed data payload or null if unmatched
     */
    parse(embed) {
        if (!embed) return null;

        const title = embed.title || '';
        const description = embed.description || '';

        // 1. Quest completed detection
        if (title.toLowerCase().includes('quest') || title.toLowerCase().includes('misi')) {
            logger.debug('[OwOEmbedParser] Detected Quest Log embed.');
            
            // Extract quest progress lines
            const quests = [];
            if (description) {
                const lines = description.split('\n');
                lines.forEach(line => {
                    if (line.includes('[') && line.includes(']')) {
                        quests.push({ text: line.trim() });
                    }
                });
            }

            return {
                activity: 'quest',
                payload: { quests }
            };
        }

        // 2. Inventory updated detection
        if (title.toLowerCase().includes('inventory') || title.toLowerCase().includes('tas')) {
            logger.debug('[OwOEmbedParser] Detected Inventory embed.');

            const items = [];
            if (embed.fields) {
                embed.fields.forEach(f => {
                    items.push({ name: f.name, value: f.value });
                });
            }

            return {
                activity: 'inventory',
                payload: { items }
            };
        }

        // 3. Pet / Zoo collection detection
        if (title.toLowerCase().includes('zoo') || title.toLowerCase().includes('kebun binatang')) {
            logger.debug('[OwOEmbedParser] Detected Zoo embed.');

            return {
                activity: 'zoo',
                payload: { description }
            };
        }

        return null; // Unhandled embed
    }
}

module.exports = new OwOEmbedParser();
