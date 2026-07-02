const crypto = require('crypto');
const widgetRenderer = require('./widgetRenderer');
const layoutManager = require('../registry/layoutManager');
const quickActionManager = require('../registry/quickActionManager');
const uiManager = require('../../ui/services/uiManager');

class DashboardRenderer {
    /**
     * Builds the entire dashboard payload (embeds, components).
     * @param {Guild} guild 
     * @param {Array} widgets 
     * @param {string} layoutId 
     * @returns {Object} payload and computed hash
     */
    async render(guild, widgets, layoutId = 'default') {
        const layout = layoutManager.get(layoutId);
        
        // Base Embed
        const embed = uiManager.components.createEmbed({
            title: `📊 Enterprise Dashboard - ${guild.name}`,
            description: `Live Monitoring Dashboard. Terakhir Diperbarui: <t:${Math.floor(Date.now() / 1000)}:R>`,
            color: 0x5865F2,
            footer: { text: 'WinterBot Framework' },
            timestamp: true
        });

        // Add Widgets
        let fields = [];
        for (const widget of widgets) {
            const content = await widgetRenderer.render(widget, guild);
            fields.push({
                name: `${widget.icon} ${widget.title}`,
                value: content,
                inline: layout.maxWidgetsPerRow > 1
            });
        }
        embed.data.fields = fields;

        // Build Quick Actions
        const actions = quickActionManager.getAll();
        let components = [];
        let currentRow = [];

        for (const action of actions) {
            const btn = uiManager.components.createButton({
                id: action.id, // Custom route handling
                label: action.label,
                emoji: action.icon,
                style: action.style || 2
            });

            currentRow.push(btn);
            if (currentRow.length === 5) {
                components.push(uiManager.components.createActionRow(currentRow));
                currentRow = [];
            }
        }

        if (currentRow.length > 0) {
            components.push(uiManager.components.createActionRow(currentRow));
        }

        const payload = { embeds: [embed], components };

        // Generate MD5 Hash to detect changes
        const hashStr = JSON.stringify(payload);
        const hash = crypto.createHash('md5').update(hashStr).digest('hex');

        return { payload, hash };
    }
}

module.exports = new DashboardRenderer();
