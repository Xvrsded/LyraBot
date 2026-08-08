require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const mongoose = require('mongoose');
const { loadEvents } = require('./handlers/eventHandler');
const { loadCommands } = require('./handlers/commandHandler');
const { startEligibilityChecker } = require('./scripts/check_eligibility');
const { startLivePayoutList } = require('./scripts/update_payout_list');
const { startLiveLeaderboard } = require('./scripts/update_leaderboard');
const { startServerStatsTracker } = require('./scripts/update_server_stats');

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
    .then(async () => {
        console.log('✅ MongoDB Connected');
        try {
            const RobuxPackage = require('./models/RobuxPackage');
            const pkg = await RobuxPackage.findOne({ type: 'custom', amount: 150 });
            if (!pkg) {
                await RobuxPackage.create({
                    type: 'custom',
                    amount: 150,
                    price: 23500,
                    label: '150 Robux Custom',
                    displayOrder: 999
                });
                console.log('✅ Created 150 Robux Custom package');
            }
        } catch (e) {
            console.error('❌ Failed to seed custom package:', e.message);
        }
    })
    .catch(err => console.error('❌ MongoDB Error:', err));

// Load Handlers
const startDashboardServer = require('./dashboard/server');

client.login(process.env.TOKEN).then(() => {
    loadEvents(client);
    loadCommands(client);
    startEligibilityChecker(client);
    startLivePayoutList(client);
    startLiveLeaderboard(client);
    startServerStatsTracker(client);
    startDashboardServer(client);
}).catch((err) => {
    console.error('❌ Failed to login:', err);
});
