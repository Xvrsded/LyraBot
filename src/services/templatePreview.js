class TemplatePreview {
    /**
     * Analyzes a fully parsed template to generate statistics and estimated setup duration.
     * @param {object} parsedTemplate The fully parsed template object
     * @returns {object} Statistics summary for preview
     */
    generatePreview(parsedTemplate) {
        if (!parsedTemplate) {
            throw new Error('Parsed template tidak boleh kosong.');
        }

        const categoriesCount = parsedTemplate.categories ? parsedTemplate.categories.length : 0;
        
        let textChannelsCount = 0;
        let voiceChannelsCount = 0;
        
        if (parsedTemplate.channels) {
            parsedTemplate.channels.forEach(chan => {
                if (chan.type === 0 || chan.type === 'GUILD_TEXT' || chan.type === 'text') {
                    textChannelsCount++;
                } else if (chan.type === 2 || chan.type === 'GUILD_VOICE' || chan.type === 'voice') {
                    voiceChannelsCount++;
                } else {
                    // Default to text channel check if type isn't specified as voice
                    textChannelsCount++;
                }
            });
        }

        const rolesCount = parsedTemplate.roles ? parsedTemplate.roles.length : 0;

        // Estimate 0.2 seconds per Discord API creation call (accounting for rate-limiting buffers)
        const totalComponents = categoriesCount + textChannelsCount + voiceChannelsCount + rolesCount;
        const estimatedTimeSeconds = Math.max(1, Math.round(totalComponents * 0.2));

        return {
            name: parsedTemplate.name,
            description: parsedTemplate.description,
            version: parsedTemplate.version,
            author: parsedTemplate.author,
            categoriesCount,
            textChannelsCount,
            voiceChannelsCount,
            rolesCount,
            estimatedTimeSeconds
        };
    }
}

module.exports = new TemplatePreview();
