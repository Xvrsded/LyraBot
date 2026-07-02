require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const db = mongoose.connection.db;
    await db.collection('cronjobs').deleteOne({ id: 'test-cron-job' });
    console.log('Deleted test-cron-job');
    process.exit(0);
});
