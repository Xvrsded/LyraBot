require('dotenv').config();
const mongoose = require('mongoose');
const StoreConfig = require('../models/StoreConfig');

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        const result = await StoreConfig.updateMany({}, {
            $set: {
                packages: [
                    { amount: 100, price: 15000 },
                    { amount: 200, price: 30000 },
                    { amount: 300, price: 45000 },
                    { amount: 400, price: 60000 },
                    { amount: 500, price: 75000 },
                    { amount: 600, price: 90000 },
                    { amount: 700, price: 105000 },
                    { amount: 800, price: 120000 },
                    { amount: 900, price: 135000 },
                    { amount: 1000, price: 150000 }
                ],
                lastPersonalAvailable: null,
                lastGroupAvailable: null,
                lastPending: null
            }
        });

        console.log(`Successfully updated ${result.modifiedCount} config documents!`);
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.connection.close();
        console.log('Connection closed.');
    }
}

run();
