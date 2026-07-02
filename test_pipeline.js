require('dotenv').config();
const mongoose = require('mongoose');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', async () => {
    console.log('Test client ready');
    const owoIntegrationService = require('./src/services/owoIntegrationService');
    const eventBus = require('./src/services/eventBus');
    const pipelineIntegrationManager = require('./src/modules/owoPipeline/services/pipelineIntegrationManager');
    
    // Initialize pipeline so it listens
    pipelineIntegrationManager.init();

    const mockMessage = {
        id: '123456789',
        content: '<@123456789012345678> found a **cow** 🐮!',
        author: {
            id: '282859044593598464',
            bot: true,
            username: 'OwO'
        },
        channel: {
            id: 'mockChannel'
        },
        guild: {
            id: '1505187513369624646'
        }
    };

    eventBus.subscribe('pipeline.finished', (data) => {
        console.log('PIPELINE FINISHED METADATA:', data.context.metadata);
        process.exit(0);
    });

    console.log('Sending mock message to owoIntegrationService...');
    await owoIntegrationService.processMessage(mockMessage);
    
    setTimeout(() => {
        console.log('Timeout.');
        process.exit(1);
    }, 5000);
});

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => client.login(process.env.DISCORD_TOKEN))
    .catch(console.error);
