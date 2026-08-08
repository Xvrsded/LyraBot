const mongoose = require('mongoose');
const { Client, GatewayIntentBits } = require('discord.js');
const Ticket = require('./src/models/Ticket');
const Order = require('./src/models/Order');
const Verification = require('./src/models/Verification');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    await client.login(process.env.TOKEN);
    console.log('Bot logged in, waiting for ready event...');

    await new Promise(resolve => client.once('ready', resolve));
    console.log('Bot is ready!');

    const guild = await client.guilds.fetch(process.env.GUILD_ID || '1094611330603946054').catch(()=>null) 
        || client.guilds.cache.first();
    
    if (guild) {
        console.log('Found guild:', guild.name);
        
        // Find channels that look like tickets
        const channels = guild.channels.cache.filter(c => 
            c.name.startsWith('gig-') || 
            c.name.startsWith('visend-') || 
            c.name.startsWith('vilog-') || 
            c.name.startsWith('copay-')
        );

        console.log(`Found ${channels.size} ticket channels. Deleting...`);
        for (const [id, channel] of channels) {
            await channel.delete().catch(e => console.log(`Failed to delete ${channel.name}:`, e.message));
            console.log(`Deleted channel: ${channel.name}`);
        }
    } else {
        console.log('Guild not found, skipping channel deletion.');
    }

    console.log('Clearing Orders and Tickets from DB...');
    await Order.deleteMany({});
    await Ticket.deleteMany({});
    console.log('Orders and Tickets cleared!');

    console.log('Clearing Verification data...');
    await Verification.deleteMany({});
    console.log('Verification data cleared!');

    console.log('Done! Exiting...');
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
