require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const TopSpender = require('../src/models/TopSpender');
        const LeaderboardState = require('../src/models/LeaderboardState');
        const LeaderboardTransaction = require('../src/models/LeaderboardTransaction');

        await TopSpender.deleteMany({});
        await LeaderboardTransaction.deleteMany({});
        await LeaderboardState.updateOne({ id: 'global' }, { $set: { lastSyncedMessageId: null } });

        console.log('Reset complete!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
