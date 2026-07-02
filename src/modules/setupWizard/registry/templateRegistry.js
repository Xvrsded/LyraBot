class TemplateRegistry {
    constructor() {
        this.templates = {
            official_owo: {
                id: 'official_owo',
                name: '⭐ Official OwO',
                description: 'Full OwO RPG ecosystem setup.',
                roles: 15,
                categories: 5,
                channels: 30,
                modules: ['Quest', 'Economy', 'Inventory', 'Marketplace', 'Decision Engine']
            },
            official_roblox: {
                id: 'official_roblox',
                name: '⭐ Official Roblox',
                description: 'Roblox Trading & Community setup.',
                roles: 10,
                categories: 4,
                channels: 20,
                modules: ['Economy', 'Marketplace']
            },
            official_community: {
                id: 'official_community',
                name: '⭐ Official Community',
                description: 'General community server setup.',
                roles: 8,
                categories: 3,
                channels: 15,
                modules: ['Leveling', 'Notification']
            },
            official_gaming: {
                id: 'official_gaming',
                name: '⭐ Official Gaming',
                description: 'Esports and general gaming setup.',
                roles: 12,
                categories: 4,
                channels: 25,
                modules: ['Leveling', 'Quest']
            },
            official_custom: {
                id: 'official_custom',
                name: '⭐ Official Custom',
                description: 'Start from scratch.',
                roles: 0,
                categories: 0,
                channels: 0,
                modules: []
            }
        };
    }

    getTemplate(id) {
        return this.templates[id] || null;
    }

    getAll() {
        return Object.values(this.templates);
    }
}

module.exports = new TemplateRegistry();
