require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        const panelUpdater = require('./src/modules/adminPanel/services/panelUpdater');
        
        // Loop through all guilds and update NEW Admin Panel
        for (const [guildId, guild] of client.guilds.cache) {
            await panelUpdater.updatePanel(client, guildId);
        }
        
        console.log('[Debug] Forced NEW Admin Panel Update completed!');
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
});

client.login(process.env.TOKEN);
