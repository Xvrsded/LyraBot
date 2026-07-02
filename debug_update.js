require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        const { updateAdminPanel: updateLegacy } = require('./src/services/adminService');
        await updateLegacy(client);
        console.log('[Debug] Forced Admin Panel Update!');
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
});

client.login(process.env.TOKEN);
