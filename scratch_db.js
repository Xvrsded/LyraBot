const mongoose = require('mongoose');
const RobuxPackage = require('./src/models/RobuxPackage');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        const result = await RobuxPackage.deleteMany({ type: 'visend', amount: 150 });
        console.log(`Deleted 150 visend package: ${result.deletedCount} documents`);
        
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.connection.close();
    }
}
run();
