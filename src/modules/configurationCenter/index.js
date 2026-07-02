const uiManager = require('../ui/services/uiManager');
const pageManager = require('../ui/services/pageManager');
const overviewPage = require('./pages/OverviewPage');

class ConfigurationCenterModule {
    init() {
        // Register the Panel in the UI Framework
        uiManager.registerPanel({
            id: 'configuration',
            title: 'Configuration Center',
            description: 'Pengaturan Dasar WinterBot Enterprise',
            icon: '⚙️',
            permissions: ['ADMINISTRATOR'],
            pages: ['index']
        });

        // Register the Index Page
        pageManager.registerPage('configuration', {
            id: 'index',
            render: (sessionData, interaction) => overviewPage.render(sessionData, interaction)
        });
        
        console.log('[ConfigurationCenter] UI Panel Registered!');
    }
}

module.exports = new ConfigurationCenterModule();
