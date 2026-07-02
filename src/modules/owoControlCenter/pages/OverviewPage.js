const headerComponent = require('../components/HeaderComponent');
const footerComponent = require('../components/FooterComponent');
const navigationGrid = require('../components/NavigationGrid');
const cardSystem = require('../components/CardSystem');
const overviewCache = require('../services/overviewCache');

class OverviewPage {
    constructor() {
        this.widgets = new Map();
    }

    registerWidget(id, renderer) {
        this.widgets.set(id, renderer);
    }

    async render(guildId, data) {
        let payload = overviewCache.get(guildId, 'overview_payload');
        if (payload) return payload;

        const header = await headerComponent.render(guildId, 'Overview Dashboard');
        
        // Compile widgets into cards
        const embedFields = [];
        for (const [id, renderer] of this.widgets.entries()) {
            const field = await cardSystem.renderCard(id, renderer, { guildId });
            embedFields.push(field);
        }

        // Apply fields to header embed for a unified look
        header.addFields(embedFields);

        const nav = navigationGrid.render();
        const footer = footerComponent.render('Overview');
        // Actually, footer text is usually put on the main embed
        header.setFooter(footer.data.footer);

        payload = { embeds: [header], components: [nav] };
        
        // Cache the fully constructed payload
        overviewCache.set(guildId, 'overview_payload', payload);
        return payload;
    }
}

module.exports = new OverviewPage();
