require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected.');
    
    // Mock the Discord Client structure minimally required
    const mockClient = {
        guilds: {
            cache: {
                get: () => ({
                    members: { fetch: async () => ({ roles: { add: async () => {} } }) },
                    roles: { cache: { get: () => ({ name: 'MockRole' }) } }
                })
            }
        },
        on: () => {},
        once: () => {}
    };

    const eventBus = require('./src/services/eventBus');
    const pipelineIntegrationManager = require('./src/modules/owoPipeline/services/pipelineIntegrationManager');
    const owoIntegrationService = require('./src/services/owoIntegrationService');
    const questEngine = require('./src/services/questEngine');
    
    // Set config so processMessage doesn't drop it
    owoIntegrationService.configCache.set('1505187513369624646', { enabled: true, ignoredChannels: [] });

    // Init modules
    questEngine.init(mockClient);
    pipelineIntegrationManager.init();
    
    console.log('Modules initialized.');
    
    // Simulate an OwO bot message for hunt
    const mockMessage = {
        id: '123456789',
        content: '**TestUser** found a <:cow:1234> **cow**! [common]',
        author: {
            id: '282859044593598464',
            bot: true,
            username: 'OwO'
        },
        channel: {
            id: 'mockChannel'
        },
        guild: {
            id: '1505187513369624646',
            members: {
                cache: [{
                    user: { username: 'TestUser' },
                    displayName: 'TestUser',
                    id: '123456789012345678'
                }]
            }
        }
    };

    let pipelineRun = false;
    eventBus.subscribe('pipeline.execute', (data) => {
        console.log('[Test] pipeline.execute emitted:', data.activity);
        pipelineRun = true;
    });

    console.log('Processing mock message...');
    await owoIntegrationService.processMessage(mockMessage);
    
    setTimeout(() => {
        console.log(`Pipeline ran: ${pipelineRun}`);
        process.exit(0);
    }, 2000);
}

run().catch(console.error);
