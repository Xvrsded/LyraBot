require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`[Debug] Logged in as ${client.user.tag}`);
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log(`[Debug] Connected to MongoDB`);
        
        // Find the last guild the bot joined
        const guild = client.guilds.cache.last();
        if (!guild) {
            console.log('[Debug] No guilds found!');
            process.exit(1);
        }
        
        console.log(`[Debug] Running panel installer for guild: ${guild.name} (${guild.id})`);
        const panelInstaller = require('./src/modules/adminPanel/services/panelInstaller');
        
        const success = await panelInstaller.install(guild, 'base');
        console.log(`[Debug] Panel Installer Result: ${success}`);
        
    } catch (err) {
        console.error('[Debug] Error:', err);
    }
    process.exit(0);
});

client.login(process.env.TOKEN);
