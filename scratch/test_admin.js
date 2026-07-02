require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const { loadEvents } = require('../src/handlers/eventHandler');
const { loadCommands } = require('../src/handlers/commandHandler');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

async function runTest() {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    // load plugins
    loadEvents(client);
    loadCommands(client);
    
    // Simulate events
    client.user = { tag: 'TestBot#1234', setPresence: () => {} };
    const eventBus = require('../src/services/eventBus');
    client.emit('clientReady', client); // initialize components
    eventBus.emit('bot.ready');
    eventBus.emit('setup.completed');
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('\n--- TESTING ALL PANELS ---');
    const panels = [
        'overview', 'owo', 'parser', 'health', 'leveling', 'dashboard', 'setup', 'configuration',
        'economy', 'inventory', 'marketplace', 'quest', 'achievement', 'moderation', 'statistics', 
        'discovery', 'automation', 'behavior', 'decision', 'channel-mapping', 'gameplay'
    ];
    
    // fake guild and interaction
    const mockGuild = { id: '123456789', name: 'Test Guild', channels: { cache: new Collection() }, roles: { cache: new Collection() }, client };
    let errors = [];

    for (const panel of panels) {
        console.log(`Testing panel: ${panel}`);
        const mockInteraction = {
            customId: `ui:${panel}:open`,
            isButton: () => true,
            isStringSelectMenu: () => false,
            isModalSubmit: () => false,
            isMessageComponent: () => true,
            guildId: mockGuild.id,
            guild: mockGuild,
            user: { id: '987654321' },
            replied: false,
            deferred: false,
            deferUpdate: async () => { mockInteraction.deferred = true; return true; },
            deferReply: async () => { mockInteraction.deferred = true; return true; },
            reply: async () => { mockInteraction.replied = true; return true; },
            editReply: async () => { return true; },
            followUp: async () => { return true; },
            update: async () => { return true; }
        };

        try {
            await client.emit('interactionCreate', mockInteraction);
            await new Promise(r => setTimeout(r, 100)); // allow async processing
        } catch (e) {
            console.error(`Error on panel ${panel}:`, e);
            errors.push({ panel, error: e.stack });
        }
    }
    
    // also catch unhandled rejections
    await new Promise(r => setTimeout(r, 1000));
    
    if (errors.length > 0) {
        console.error(`\nFAILED! ${errors.length} panels threw errors.`);
        process.exit(1);
    } else {
        console.log('\nALL PANELS RENDERED SUCCESSFULLY.');
        process.exit(0);
    }
}

let unhandledErrors = [];
process.on('unhandledRejection', e => {
    console.error('Unhandled Rejection:', e);
    unhandledErrors.push(e);
});
process.on('uncaughtException', e => {
    console.error('Uncaught Exception:', e);
    unhandledErrors.push(e);
});

runTest().catch(console.error);
