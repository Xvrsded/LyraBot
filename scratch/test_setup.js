require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const { loadEvents } = require('../src/handlers/eventHandler');
const { loadCommands } = require('../src/handlers/commandHandler');
const eventBus = require('../src/services/eventBus');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
client.user = { tag: 'TestBot#1234', setPresence: () => {} };

async function runSetupTest() {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    // load plugins
    loadEvents(client);
    loadCommands(client);
    
    // Simulate startup
    client.emit('clientReady', client);
    eventBus.emit('bot.ready');
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('\n--- TESTING SETUP WIZARD PIPELINE ---');
    
    const mockGuild = { 
        id: '123456789', 
        name: 'Test Setup Guild', 
        channels: { 
            cache: new Collection(),
            create: async (data) => {
                console.log(`Mocking channel create: ${data.name}`);
                return { id: `chan_${data.name}` };
            }
        }, 
        roles: { 
            cache: new Collection(),
            create: async (data) => {
                console.log(`Mocking role create: ${data.name}`);
                return { id: `role_${data.name}` };
            }
        }, 
        client 
    };

    const createMockInteraction = (customId, values = null) => {
        const mockInteraction = {
            customId,
            isButton: () => !values,
            isStringSelectMenu: () => !!values,
            isModalSubmit: () => false,
            isMessageComponent: () => true,
            isChatInputCommand: () => false,
            isAutocomplete: () => false,
            values: values || [],
            guildId: mockGuild.id,
            guild: mockGuild,
            user: { id: '987654321' },
            replied: false,
            deferred: false,
            deferUpdate: async () => { mockInteraction.deferred = true; return true; },
            deferReply: async () => { mockInteraction.deferred = true; return true; },
            reply: async (msg) => { mockInteraction.replied = true; console.log(`[Mock Reply]:`, msg); return true; },
            editReply: async (msg) => { console.log(`[Mock EditReply]:`, msg); return true; },
            update: async (msg) => { console.log(`[Mock Update]:`, msg); return true; },
            followUp: async (msg) => { console.log(`[Mock FollowUp]:`, msg); return true; }
        };
        return mockInteraction;
    };

    const steps = [
        { name: '1. Open Wizard', event: createMockInteraction('ui:setup:open') },
        { name: '2. Select Base Template', event: createMockInteraction('wizard_select_template', ['base']) },
        { name: '3. Next Step', event: createMockInteraction('wizard_next') },
        { name: '4. Start Orchestrator', event: createMockInteraction('wizard_start') },
    ];

    let errors = [];

    for (const step of steps) {
        console.log(`\nExecuting: ${step.name}`);
        try {
            await client.emit('interactionCreate', step.event);
            await new Promise(r => setTimeout(r, 1000)); // wait for orchestrator to finish
        } catch (e) {
            console.error(`Error during ${step.name}:`, e);
            errors.push({ step: step.name, error: e.stack });
        }
    }
    
    await new Promise(r => setTimeout(r, 3000)); // allow async processing to settle
    
    if (errors.length > 0) {
        console.error(`\nFAILED! ${errors.length} steps threw errors.`);
        process.exit(1);
    } else {
        console.log('\nSETUP WIZARD PIPELINE COMPLETED SUCCESSFULLY.');
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

runSetupTest().catch(console.error);
