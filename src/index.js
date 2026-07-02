require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const { loadEvents } = require('./handlers/eventHandler');
const { loadCommands } = require('./handlers/commandHandler');
const { startEligibilityChecker } = require('./scripts/check_eligibility');
const { startLivePayoutList } = require('./scripts/update_payout_list');
const { startLiveLeaderboard } = require('./scripts/update_leaderboard');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

client.commands = new Collection();

// Tangkap error global agar bot tidak mati/crash
client.on('error', error => {
    console.error('Discord Client Error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
});

// Instrument MongoDB queries for metrics tracking
require('./utils/mongooseInstrumentation').instrument();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// Load Handlers
client.login(process.env.TOKEN).then(() => {
    loadEvents(client);
    loadCommands(client);
    startEligibilityChecker(client);
    startLivePayoutList(client);
    startLiveLeaderboard(client);
}).catch((err) => {
    console.error('❌ Failed to login:', err);
});
