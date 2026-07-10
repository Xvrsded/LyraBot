const Order = require('../models/Order');
const ProductOrder = require('../models/ProductOrder');
const Config = require('../models/Config');
const User = require('../models/User');
const { EmbedBuilder } = require('discord.js');

let updateLeaderboardFn = null;

function startLiveLeaderboard(client) {
    // 10 minutes fallback interval
    const UPDATE_INTERVAL = 10 * 60 * 1000;
    const CHANNEL_ID = '1520335952206368892';

    const updateLeaderboardMessage = async () => {
        try {
            console.log('🔄 Mengupdate Live Leaderboard...');

            // Get or create config from DB
            let configDoc = await Config.findOne({ key: 'leaderboardConfig' });
            if (!configDoc) {
                configDoc = await Config.create({
                    key: 'leaderboardConfig',
                    value: { channelId: CHANNEL_ID, messageId: null }
                });
            }

            const channelId = configDoc.value.channelId || CHANNEL_ID;
            let messageId = configDoc.value.messageId;

            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                console.log(`❌ Channel dengan ID ${channelId} tidak ditemukan.`);
                return;
            }

            const matchStage = { status: { $in: ['delivered', 'completed'] } };

            // 1. Fetch Robux orders
            const robuxOrders = await Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: '$userId',
                        totalRobux: { $sum: '$robuxAmount' },
                        totalSpent: { $sum: '$price' },
                        totalOrders: { $sum: 1 },
                        lastRobloxUsername: { $last: '$robloxUsername' }
                    }
                }
            ]);

            // 2. Fetch Product orders
            const productOrders = await ProductOrder.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: '$userId',
                        totalSpent: { $sum: '$price' },
                        totalOrders: { $sum: 1 }
                    }
                }
            ]);

            // 3. Combine in JavaScript
            const userMap = new Map();

            for (const entry of robuxOrders) {
                userMap.set(entry._id, {
                    userId: entry._id,
                    totalRobux: entry.totalRobux,
                    totalSpent: entry.totalSpent,
                    totalOrders: entry.totalOrders,
                    lastRobloxUsername: entry.lastRobloxUsername
                });
            }

            for (const entry of productOrders) {
                if (userMap.has(entry._id)) {
                    const existing = userMap.get(entry._id);
                    existing.totalSpent += entry.totalSpent;
                    existing.totalOrders += entry.totalOrders;
                } else {
                    userMap.set(entry._id, {
                        userId: entry._id,
                        totalRobux: 0,
                        totalSpent: entry.totalSpent,
                        totalOrders: entry.totalOrders,
                        lastRobloxUsername: null
                    });
                }
            }

            // Fetch Roblox usernames from User model for entries missing robloxUsername
            const userIdsWithoutRoblox = Array.from(userMap.values())
                .filter(u => !u.lastRobloxUsername)
                .map(u => u.userId);

            if (userIdsWithoutRoblox.length > 0) {
                const verifiedUsers = await User.find({ discordId: { $in: userIdsWithoutRoblox } });
                for (const vUser of verifiedUsers) {
                    const entry = userMap.get(vUser.discordId);
                    if (entry) {
                        entry.lastRobloxUsername = vUser.robloxUsername;
                    }
                }
            }

            // Sort by totalSpent descending
            const leaderboard = Array.from(userMap.values())
                .sort((a, b) => b.totalSpent - a.totalSpent);

            // 4. Server stats aggregation (Robux + Products)
            const serverRobuxStats = await Order.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalRobux: { $sum: '$robuxAmount' },
                        totalSpent: { $sum: '$price' },
                        totalOrders: { $sum: 1 }
                    }
                }
            ]);

            const serverProductStats = await ProductOrder.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalSpent: { $sum: '$price' },
                        totalOrders: { $sum: 1 }
                    }
                }
            ]);

            const rStats = serverRobuxStats[0] || { totalRobux: 0, totalSpent: 0, totalOrders: 0 };
            const pStats = serverProductStats[0] || { totalSpent: 0, totalOrders: 0 };

            const totalRobux = rStats.totalRobux;
            const totalSpent = rStats.totalSpent + pStats.totalSpent;
            const totalOrders = rStats.totalOrders + pStats.totalOrders;

            // 5. Generate formatted description with dividers
            let leaderboardText = '';
            if (leaderboard.length === 0) {
                leaderboardText = '_Belum ada data transaksi selesai._';
            } else {
                const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                leaderboardText = leaderboard.slice(0, 10).map((entry, index) => {
                    const emoji = index < 10 ? rankEmojis[index] : `🏅`;
                    const robloxText = entry.lastRobloxUsername ? ` (\`${entry.lastRobloxUsername}\`)` : '';
                    return `${emoji} **#${index + 1} | <@${entry.userId}>**${robloxText}\n` +
                           `├ 💎 **Volume Robux:** \`${entry.totalRobux.toLocaleString('id-ID')} R$\`\n` +
                           `├ 💵 **Volume Belanja:** \`Rp ${entry.totalSpent.toLocaleString('id-ID')}\`\n` +
                           `└ 📦 **Total Transaksi:** \`${entry.totalOrders}x\``;
                }).join('\n───────────────────\n');
            }

            const statsText = `├ 💎 **Total Robux Terjual:** \`${totalRobux.toLocaleString('id-ID')} R$\`\n` +
                              `├ 💵 **Total Volume Belanja:** \`Rp ${totalSpent.toLocaleString('id-ID')}\`\n` +
                              `└ 📦 **Total Order Selesai:** \`${totalOrders}x\``;

            // Description has a 4096-character limit, whereas fields have a 1024-character limit.
            // Putting leaderboardText inside description avoids CombinedPropertyError length constraint crashes.
            const embed = new EmbedBuilder()
                .setTitle('🏆 WinterStore - Robux & Product Leaderboard')
                .setDescription(
                    'Daftar pembeli dengan total nominal belanja terbanyak di WinterStore.\n\n' +
                    '**🏆 Top Buyers (All-Time)**\n' +
                    leaderboardText
                )
                .setColor('#0099ff')
                .addFields(
                    { name: '📊 Akumulasi Server (All-Time)', value: statsText, inline: false }
                )
                .setFooter({ text: 'WinterStore Leaderboard System' })
                .setTimestamp();

            let liveMessage = null;
            if (messageId) {
                try {
                    liveMessage = await channel.messages.fetch(messageId);
                } catch (err) {
                    console.log(`❌ Pesan Leaderboard dengan ID ${messageId} tidak ditemukan, membuat pesan baru.`);
                }
            }

            if (liveMessage) {
                await liveMessage.edit({ embeds: [embed] });
                console.log('✅ Live Leaderboard berhasil di-update.');
            } else {
                const sentMessage = await channel.send({ embeds: [embed] });
                configDoc.value.messageId = sentMessage.id;
                configDoc.markModified('value');
                await configDoc.save();
                console.log('✅ Live Leaderboard baru berhasil dikirim dan ID disimpan.');
            }

        } catch (error) {
            console.error('❌ Error saat update Live Leaderboard:', error);
        }
    };

    updateLeaderboardFn = updateLeaderboardMessage;
    setInterval(updateLeaderboardMessage, UPDATE_INTERVAL);

    // Initial run after startup (10s delay to let client connect)
    setTimeout(() => {
        updateLeaderboardMessage();
    }, 10000);
}

async function triggerLeaderboardUpdate() {
    if (updateLeaderboardFn) {
        console.log('⚡ Triggering instant leaderboard update...');
        await updateLeaderboardFn().catch(console.error);
    } else {
        console.log('⚠️ updateLeaderboardFn not initialized yet.');
    }
}

module.exports = { startLiveLeaderboard, triggerLeaderboardUpdate };
