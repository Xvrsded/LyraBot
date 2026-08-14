const mongoose = require('mongoose');
const RobuxPackage = require('./src/models/RobuxPackage');
require('dotenv').config();

const VISEND_PRICE_CATALOG = [
    { amount: 100, price: 16000, sortOrder: 1 },
    { amount: 200, price: 32000, sortOrder: 2 },
    { amount: 300, price: 48000, sortOrder: 3 },
    { amount: 400, price: 64000, sortOrder: 4 },
    { amount: 500, price: 80000, sortOrder: 5 },
    { amount: 600, price: 96000, sortOrder: 6 },
    { amount: 700, price: 112000, sortOrder: 7 },
    { amount: 800, price: 128000, sortOrder: 8 },
    { amount: 900, price: 144000, sortOrder: 9 },
    { amount: 1000, price: 160000, sortOrder: 10 }
];

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const targetAmounts = VISEND_PRICE_CATALOG.map(pkg => pkg.amount);

        // Upsert required packages
        await Promise.all(VISEND_PRICE_CATALOG.map(pkg => RobuxPackage.findOneAndUpdate(
            { type: 'visend', amount: pkg.amount },
            {
                type: 'visend',
                amount: pkg.amount,
                price: pkg.price,
                sortOrder: pkg.sortOrder,
                displayOrder: pkg.sortOrder,
                isActive: true
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )));

        // Delete unwanted packages (e.g. 50, 150)
        const delResult = await RobuxPackage.deleteMany({ type: 'visend', amount: { $nin: targetAmounts } });
        console.log(`Deleted ${delResult.deletedCount} unwanted visend packages.`);

        // Verify remaining
        const remaining = await RobuxPackage.find({ type: 'visend' }).sort({ amount: 1 });
        console.log(`Remaining visend packages (${remaining.length}):`);
        remaining.forEach(pkg => {
            console.log(`- ${pkg.amount} Robux = Rp${pkg.price}`);
        });

    } catch (e) {
        console.error('Error in DB script:', e);
    } finally {
        mongoose.connection.close();
    }
}
run();
