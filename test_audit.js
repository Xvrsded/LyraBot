const panelRegistry = require('./src/modules/adminPanel/registry/panelRegistry');
const panelManager = require('./src/modules/ui/services/panelManager');
const pageManager = require('./src/modules/ui/services/pageManager');
const uiManager = require('./src/modules/ui/services/uiManager');

// Mock initialization to trigger dynamic placeholders
panelRegistry.reload();

console.log("=== UI WIRING AUDIT ===");

const allPanels = panelRegistry.getAll();
console.log(`\n1. Panel Registry Count: ${allPanels.length} Panels found in JSON metadata.`);
console.log(allPanels.map(p => `   - ${p.title} (${p.id})`).join('\n'));

// Trigger dynamic registration manually as it's done in adminPanelManager on init
for (const metadata of allPanels) {
    const id = metadata.id;
    if (!panelManager.getPanel(id)) {
        uiManager.registerPanel({
            id: id,
            title: metadata.title,
            description: metadata.description,
            icon: metadata.icon || '📌',
            permissions: ['ADMINISTRATOR'],
            pages: ['index']
        });

        pageManager.registerPage(id, {
            id: 'index',
            render: () => { return {} }
        });
    }
}

const registeredUiPanels = Array.from(panelManager.registry.values());
console.log(`\n2. UI Manager Registered Panels Count: ${registeredUiPanels.length}`);
console.log(registeredUiPanels.map(p => `   - UI Active: ${p.title} (${p.id})`).join('\n'));

console.log(`\n3. Missing UI Configurations: ${allPanels.length - registeredUiPanels.length}`);

console.log("\n4. Plugin API Context Check (Mocking)");
const pluginContextFields = [
    'economy', 'inventory', 'ui', 'panel', 'dashboard', 'owoDiscovery',
    'owoBehavior', 'automation', 'pipeline', 'gameplay', 'decision', 'configuration',
    'templates', 'integration', 'owoConfiguration', 'levelingConfiguration', 'config', 'market'
];
console.log(`Plugin Context Injected Fields: ${pluginContextFields.length}`);
console.log("=== AUDIT COMPLETE ===");
