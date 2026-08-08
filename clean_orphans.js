const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

const Order = require('./src/models/Order');
const Ticket = require('./src/models/Ticket');
const queueService = require('./src/services/queueService');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

async function run() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('DB connected.');

        client.once('ready', async () => {
            console.log(`Bot logged in as ${client.user.tag}`);
            
            const activeOrders = await Order.find({ status: { $in: ['pending', 'paid', 'processing'] } });
            console.log(`Found ${activeOrders.length} active orders in DB.`);

            let orphansDeleted = 0;

            for (const order of activeOrders) {
                try {
                    const channel = await client.channels.fetch(order.channelId).catch(() => null);
                    if (!channel) {
                        // Channel is missing, it's an orphan
                        console.log(`[ORPHAN] Order ${order.orderId} (Channel ${order.channelId}) missing. Deleting...`);
                        await Order.deleteOne({ _id: order._id });
                        await Ticket.updateMany({ orderId: order.orderId }, { status: 'closed' });
                        orphansDeleted++;
                    }
                } catch (err) {
                    console.log(`Error checking order ${order.orderId}:`, err.message);
                }
            }

            console.log(`Cleaned up ${orphansDeleted} orphaned orders.`);
            
            // Sync queue
            console.log('Updating queue status...');
            await queueService.updateQueueStatus(client);
            console.log('Queue status updated.');
            
            process.exit(0);
        });

        client.login(process.env.TOKEN);
    } catch (err) {

        console.error(err);
        process.exit(1);
    }
}

run();
