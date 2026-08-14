require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const mongoose = require('mongoose');
const { loadEvents } = require('./handlers/eventHandler');
const { loadCommands } = require('./handlers/commandHandler');
const { startEligibilityChecker } = require('./scripts/check_eligibility');
const { startLivePayoutList } = require('./scripts/update_payout_list');
const { startLiveLeaderboard } = require('./scripts/update_leaderboard');
const { startServerStatsTracker } = require('./scripts/update_server_stats');
const logger = require('./utils/logger');

console.log('[BOOT] Starting LyraBot...');
console.log('[BOOT] Loading configuration...');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.User
    ]
});

client.commands = new Collection();

// Global Error Handling
client.on('error', error => {
    console.error('[ERROR] Discord Client Error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', error => {
    console.error('[ERROR] Uncaught Exception:', error);
    // Biarkan process terus berjalan (PM2 akan handle restart jika fatal).
});

// Instrument MongoDB queries for metrics tracking
require('./utils/mongooseInstrumentation').instrument();

console.log('[BOOT] Connecting MongoDB...');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { family: 4, serverSelectionTimeoutMS: 60000 })
    .then(async () => {
        console.log('[BOOT] MongoDB connected.');
        // Clean up legacy 150 custom package if it exists
        try {
            const RobuxPackage = require('./models/RobuxPackage');
            await RobuxPackage.deleteMany({ type: 'custom', amount: 150 });
            console.log('[BOOT] Cleaned up legacy 150 custom packages');
        } catch (e) {
            console.error('[ERROR] Failed to clean custom package:', e.message);
        }
    })
    .catch(err => {
        console.error('[ERROR] MongoDB Connection Error:', err);
    });

console.log('[BOOT] Loading events...');
loadEvents(client);

console.log('[BOOT] Loading commands...');
loadCommands(client).then(() => {
    console.log('[BOOT] Commands synchronized.');
});

client.once('ready', () => {
    logger.setClient(client);
    console.log(`[DISCORD] Logged in as ${client.user.tag}`);
    console.log('[READY] LyraBot is ready.');

    console.log('[BOOT] Initializing schedulers and trackers...');
    startEligibilityChecker(client);
    startLivePayoutList(client);
    startLiveLeaderboard(client);
    startServerStatsTracker(client);
});

console.log('[DISCORD] Logging in...');
client.login(process.env.TOKEN).catch((err) => {
    console.error('[ERROR] Failed to login to Discord:', err);
    process.exit(1);
});
