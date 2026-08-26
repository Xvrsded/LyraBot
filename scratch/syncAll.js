require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const LeaderboardTransaction = require('../src/models/LeaderboardTransaction');
const TopSpender = require('../src/models/TopSpender');
const LeaderboardState = require('../src/models/LeaderboardState');
// Removed broken import

const LOG_CHANNEL_ID = '1534624789065498795';

function calcBadge(spending) {
    if (spending >= 10000000) return 'Eternal';
    if (spending >= 5000000) return 'Diamond';
    if (spending >= 2000000) return 'Gold';
    if (spending >= 500000) return 'Silver';
    return 'Bronze';
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

mongoose.connect(process.env.MONGO_URI).then(() => {
    client.login(process.env.TOKEN).then(async () => {
        console.log('Connected to Discord');
        
        await TopSpender.deleteMany({});
        await LeaderboardTransaction.deleteMany({});
        console.log('Cleared DB');

        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        let hasMore = true;
        let lastId = null;
        let total = 0;
        let newestMessageId = null;

        // Map to keep track of spenders in memory to avoid constant DB writes
        const spenders = new Map();

        while (hasMore) {
            const options = { limit: 100 };
            if (lastId) options.before = lastId;

            const messages = await channel.messages.fetch(options);
            if (messages.size === 0) break;

            if (!newestMessageId) {
                newestMessageId = messages.first().id; // The very first message fetched (newest in channel)
            }

            console.log(`Fetched ${messages.size} messages...`);
            
            const msgs = Array.from(messages.values());
            
            for (const msg of msgs) {
                if (msg.embeds.length > 0) {
                    const embed = msg.embeds[0];
                    if (embed.title === '🧾 Transaction Completed') {
                        const statusField = embed.fields.find(f => f.name.includes('Status'));
                        if (statusField && statusField.value.includes('Success')) {
                            const customerField = embed.fields.find(f => f.name.includes('Customer'));
                            const totalField = embed.fields.find(f => f.name.includes('Total'));

                            if (customerField && totalField) {
                                const userIdMatch = customerField.value.match(/<@!?(\d+)>/);
                                if (userIdMatch) {
                                    const userId = userIdMatch[1];
                                    const amount = parseInt(totalField.value.replace(/[^0-9]/g, ''), 10);
                                    
                                    if (!isNaN(amount)) {
                                        await LeaderboardTransaction.create({
                                            userId,
                                            amount,
                                            messageId: msg.id,
                                            createdAt: new Date(msg.createdTimestamp)
                                        }).catch(()=>null); // Ignore duplicates if any

                                        if (!spenders.has(userId)) {
                                            spenders.set(userId, { totalSpending: 0, totalOrders: 0, lastPurchase: new Date(msg.createdTimestamp) });
                                        }
                                        const s = spenders.get(userId);
                                        s.totalSpending += amount;
                                        s.totalOrders += 1;
                                        if (msg.createdTimestamp > s.lastPurchase.getTime()) {
                                            s.lastPurchase = new Date(msg.createdTimestamp);
                                        }
                                        total++;
                                    }
                                }
                            }
                        }
                    }
                }
                lastId = msg.id;
            }
        }

        console.log(`Finished processing. Total success transactions: ${total}`);
        
        // Save TopSpenders
        for (const [userId, data] of spenders.entries()) {
            await TopSpender.create({
                userId,
                totalSpending: data.totalSpending,
                totalOrders: data.totalOrders,
                lastPurchase: data.lastPurchase,
                customerBadge: calcBadge(data.totalSpending)
            });
        }
        
        // Update state
        if (newestMessageId) {
            await LeaderboardState.updateOne({ id: 'global' }, { $set: { lastSyncedMessageId: newestMessageId } }, { upsert: true });
        }

        console.log('Done mapping everything to DB!');
        process.exit(0);
    });
});
