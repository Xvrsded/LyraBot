require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Mock Guild to prevent crashes during render logic testing
const mockGuild = {
    id: '123456789',
    name: 'Audit Guild',
    client: client,
    channels: { cache: { size: 10, filter: () => ({ size: 2 }) } },
    roles: { cache: { size: 5 } }
};

const mockInteraction = {
    guildId: mockGuild.id,
    guild: mockGuild,
    user: { id: '987654321' }
};

const mockSessionData = {};

async function runAudit() {
    console.log('Connecting to MongoDB for accurate Mongoose verification...');
    await mongoose.connect(process.env.MONGO_URI);

    // Initialize PluginContext
    const PluginContext = require('../src/services/pluginContext');
    const pluginCtx = new PluginContext(client, null);
    
    // We need to initialize the managers so they don't return undefined APIs
    require('../src/modules/configurationCenter/services/configCenterManager').init(client);
    require('../src/modules/dashboard/services/dashboardManager').init(client);
    require('../src/modules/owoDiscovery/services/owoDiscoveryManager').init(client);
    require('../src/modules/owoBehavior/services/behaviorManager').init(client);
    require('../src/modules/owoAutomation/services/automationManager').init(client);
    require('../src/modules/owoDecision/services/decisionManager').init(client);
    require('../src/modules/owoControlCenter/services/controlCenterManager').init(client);
    require('../src/modules/owoAdminIntegration/services/adminIntegrationManager').init(client);
    require('../src/modules/owoPipeline/services/pipelineIntegrationManager').init();

    // Setup Legacy Engines explicitly if needed
    require('../src/services/achievementRegistry').loadAll();
    require('../src/services/questRegistry').loadAll();

    console.log('Plugins & Dependencies injected.');

    const pagesDir = path.join(__dirname, '../src/modules/adminPanel/pages');
    const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.js'));
    
    console.log('\n=====================================');
    console.log('RUNTIME AUDIT EXECUTION');
    console.log('=====================================\n');

    let errorCount = 0;

    for (const file of files) {
        const filePath = path.join(pagesDir, file);
        let status = 'PASS';
        let errorMsg = null;
        try {
            const page = require(filePath);
            if (typeof page.render !== 'function') {
                throw new Error('render() is not a function');
            }
            
            // Execute render
            const result = await page.render(mockGuild.id, mockGuild, pluginCtx);
            
            // If the code uses try/catch and returns an Error embed, detect it:
            if (result && result.embeds && result.embeds.length > 0) {
                const embed = result.embeds[0];
                if (embed.data && embed.data.title === 'Error') {
                    throw new Error(embed.data.description);
                }
            }
        } catch (err) {
            status = 'FAIL';
            errorMsg = err.stack.split('\n').slice(0, 3).join('\n'); // capture first 3 lines of stack
            errorCount++;
        }

        console.log(`[${status}] ${file}`);
        if (status === 'FAIL') {
            console.log(`        -> ${errorMsg}`);
        }
    }

    console.log('\n=====================================');
    console.log(`TOTAL RUNTIME ERRORS: ${errorCount}`);
    
    await mongoose.disconnect();
    process.exit(errorCount > 0 ? 1 : 0);
}

runAudit().catch(console.error);
