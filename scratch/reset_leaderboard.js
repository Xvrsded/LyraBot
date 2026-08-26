require('dotenv').config();
const mongoose = require('mongoose');
const TopSpender = require('../src/models/TopSpender');
const LeaderboardState = require('../src/models/LeaderboardState');
const LeaderboardTransaction = require('../src/models/LeaderboardTransaction');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await TopSpender.deleteMany({});
        await LeaderboardTransaction.deleteMany({});
        await LeaderboardState.updateOne({ id: 'global' }, { $set: { lastSyncedMessageId: null } });
        console.log('Leaderboard state reset. You can now run /setupleaderboard in discord to re-sync.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
