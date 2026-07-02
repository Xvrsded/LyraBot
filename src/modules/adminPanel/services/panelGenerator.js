const panelRegistry = require('../registry/panelRegistry');
const panelPermission = require('./panelPermission');
const logger = require('../../../utils/logger');
const componentManager = require('../../ui/services/componentManager');

class PanelGenerator {
    /**
     * Generates the Main Admin Panel UI for a specific guild and member.
     * @param {Guild} guild Discord Guild object
     * @param {GuildMember} member Discord GuildMember object
     * @param {string} template Active server template (base, owo, roblox)
     */
    async generateMainPanel(guild, member, template = 'base') {
        const panels = panelRegistry.getAll();
        
        // Filter by visibility and permissions
        const visiblePanels = panels.filter(p => {
            if (p.visible === false) return false;
            if (p.permission && !panelPermission.hasPermission(member, p.permission)) return false;
            return true;
        });

        // Sort by order
        visiblePanels.sort((a, b) => (a.order || 99) - (b.order || 99));

        // Create Embed
        const embed = componentManager.createEmbed({
            title: `⚙️ Master Admin Panel - ${guild.name}`,
            description: `Selamat datang di Pusat Kontrol Server.\nTemplate Aktif: **${template.toUpperCase()}**\n\nSilakan pilih menu di bawah ini untuk mengatur modul secara instan.`,
            color: 0x2B2D31,
            footer: { text: 'WinterBot Enterprise Admin Framework' },
            timestamp: true
        });

        // Generate Buttons (Max 5 per action row)
        let components = [];
        let currentRow = [];

        for (const p of visiblePanels) {
            const btn = componentManager.createButton({
                id: `ui:${p.id}:open:index`, // Routes to the panel's index page
                label: p.title,
                emoji: p.icon,
                style: 2 // Secondary
            });

            currentRow.push(btn);
            if (currentRow.length === 5) {
                components.push(componentManager.createActionRow(currentRow));
                currentRow = [];
            }
        }

        if (currentRow.length > 0) {
            components.push(componentManager.createActionRow(currentRow));
        }

        return { embeds: [embed], components };
    }
}

module.exports = new PanelGenerator();
