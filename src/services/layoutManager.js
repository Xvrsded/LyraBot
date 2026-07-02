/**
 * layoutManager.js
 * Service for dynamically renaming channels and categories in a server.
 */

const { ChannelType } = require('discord.js');
const logger = require('../utils/logger');

const delay = ms => new Promise(res => setTimeout(res, ms));

const STYLES = {
    gamer: {
        formatCategory: (name) => `[ ⚡ ${name.toUpperCase()} ]`,
        formatChannel: (icon, name) => `${icon || '💬'} ⫸ ${name}`
    },
    diamond: {
        formatCategory: (name) => `╭ ✦・${name.toUpperCase()}`,
        formatChannel: (icon, name) => `${icon || '💬'} ❖ ${name} ❖`
    },
    royal: {
        formatCategory: (name) => `⎯⎯⎯ ✦ ${name.toUpperCase()} ✦ ⎯⎯⎯`,
        formatChannel: (icon, name) => `${icon || '💬'} ⧼ ${name} ⧽`
    },
    nodes: {
        formatCategory: (name) => `『 🌸 』 ${name.toUpperCase()}`,
        formatChannel: (icon, name) => `⑆ ${icon || '💬'} ⑆ ${name}`
    },
    branch: {
        formatCategory: (name) => `╭ ✦・${name.toUpperCase()}`,
        formatChannel: (icon, name) => `┣・${icon || '💬'}・${name}`
    },
    restore: {
        formatCategory: (name) => `${name.toUpperCase()}`,
        formatChannel: (icon, name) => `${icon || '💬'}・${name}`
    }
};

class LayoutManager {
    /**
     * Extracts icon and clean name from an existing channel string.
     * Attempts to find leading emojis or symbols.
     * @param {string} originalName 
     */
    parseChannelName(originalName) {
        // Extract everything before the first word character as the potential icon
        // We match non-alphanumeric chars at start (including spaces, dashes, fancy borders)
        const match = originalName.match(/^([^\w]+)(.+)$/u);
        
        if (match) {
            let iconStr = match[1];
            let name = match[2].trim().toLowerCase().replace(/\s+/g, '-');
            
            // Clean the icon string from separators
            let icon = iconStr.replace(/[\s\-\・\│\|_『』╭╰⊢✦>_\[\]]/g, '').trim();
            if (!icon) icon = '💬'; // Default if it was just separators

            // Clean name from lingering separators
            name = name.replace(/[『』╭╰⊢✦>_\[\]]/g, '').trim();
            
            return { icon, name };
        }
        
        // Fallback
        let name = originalName.toLowerCase().replace(/\s+/g, '-').replace(/[『』╭╰⊢✦>_\[\]]/g, '').trim();
        return { icon: '💬', name };
    }

    /**
     * Extracts clean name from a category.
     * @param {string} originalName 
     */
    parseCategoryName(originalName) {
        // Strip out all non-alphanumeric characters except spaces
        let clean = originalName.replace(/[^\w\s-]/g, '').trim().toUpperCase();
        if (!clean) clean = "CATEGORY";
        return clean;
    }

    /**
     * Updates all channels in a guild according to a chosen style.
     * @param {import('discord.js').Guild} guild 
     * @param {string} styleName 
     * @param {Function} progressCallback 
     */
    async applyLayout(guild, styleName, progressCallback) {
        const style = STYLES[styleName.toLowerCase()];
        if (!style) throw new Error(`Style '${styleName}' not found.`);

        const channels = await guild.channels.fetch();
        let updatedCount = 0;
        let errorCount = 0;

        for (const [id, channel] of channels) {
            try {
                let newName = '';

                if (channel.type === ChannelType.GuildCategory) {
                    const cleanName = this.parseCategoryName(channel.name);
                    newName = style.formatCategory(cleanName);
                } else if (
                    channel.type === ChannelType.GuildText || 
                    channel.type === ChannelType.GuildVoice || 
                    channel.type === ChannelType.GuildAnnouncement ||
                    channel.type === ChannelType.GuildForum
                ) {
                    const { icon, name } = this.parseChannelName(channel.name);
                    newName = style.formatChannel(icon, name);
                }

                if (newName && channel.name !== newName) {
                    // Truncate if too long (Discord limit is 100)
                    newName = newName.substring(0, 100);
                    await channel.setName(newName, `Layout Manager: Applied ${styleName} style`);
                    updatedCount++;
                    if (progressCallback) progressCallback(updatedCount, channels.size);
                    
                    // Delay to prevent Discord API rate limiting (1.5 seconds)
                    await delay(1500);
                }
            } catch (err) {
                logger.error(`[LayoutManager] Failed to rename channel ${channel.id}:`, err.message);
                errorCount++;
            }
        }

        return { updated: updatedCount, errors: errorCount };
    }
}

module.exports = new LayoutManager();
