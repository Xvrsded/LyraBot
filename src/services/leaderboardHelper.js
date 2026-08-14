const { EmbedBuilder } = require('discord.js');
const Order = require('../models/Order');
const ProductOrder = require('../models/ProductOrder');
const User = require('../models/User');

async function generateLeaderboardEmbed(interactionUser, timeframe = 'alltime') {
    const matchStage = {
        status: { $in: ['delivered', 'completed'] }
    };

    let timeframeText = 'Semua Waktu';
    const now = new Date();

    if (timeframe === 'daily') {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        matchStage.createdAt = { $gte: startOfDay };
        timeframeText = 'Harian';
    } else if (timeframe === 'weekly') {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        matchStage.createdAt = { $gte: startOfWeek };
        timeframeText = 'Minggu Ini';
    } else if (timeframe === 'monthly') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        matchStage.createdAt = { $gte: startOfMonth };
        timeframeText = 'Bulan Ini';
    }

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

    const leaderboard = Array.from(userMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent);

    if (leaderboard.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setTitle('🏆 WinterStore - Robux & Product Leaderboard')
            .setDescription(`Belum ada data pembelian untuk periode **${timeframeText}**.`)
            .setColor('#0099ff')
            .setTimestamp();
        return emptyEmbed;
    }

    const userRankIndex = leaderboard.findIndex(entry => entry.userId === interactionUser.id);
    const userRank = userRankIndex !== -1 ? userRankIndex + 1 : null;
    const userStats = userRank !== null ? leaderboard[userRankIndex] : null;

    const topTen = leaderboard.slice(0, 10);
    let description = `Berikut adalah peringkat pembeli terbanyak untuk periode **${timeframeText}**:\n\n`;

    description += topTen.map((entry, index) => {
        const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const rankText = index < 10 ? rankEmojis[index] : `🏅`;
        const robloxText = entry.lastRobloxUsername ? ` (\`${entry.lastRobloxUsername}\`)` : '';
        return `${rankText} **#${index + 1} | <@${entry.userId}>**${robloxText}\n` +
               `├ 💎 **Volume Robux:** \`${entry.totalRobux ? entry.totalRobux.toLocaleString('id-ID') : 0} R$\`\n` +
               `├ 💵 **Volume Belanja:** \`Rp ${entry.totalSpent.toLocaleString('id-ID')}\`\n` +
               `└ 📦 **Total Transaksi:** \`${entry.totalOrders}x\``;
    }).join('\n───────────────────\n');

    const embed = new EmbedBuilder()
        .setTitle('🏆 WinterStore - Robux & Product Leaderboard')
        .setDescription(description)
        .setColor('#0099ff')
        .setFooter({ text: 'WinterStore Leaderboard System' })
        .setTimestamp();

    if (userRank !== null && userStats) {
        embed.addFields({
            name: '👤 Peringkat Anda',
            value: `Peringkat **#${userRank}** dari **${leaderboard.length}** pembeli\n` +
                   `├ 💎 **Volume Robux:** \`${userStats.totalRobux ? userStats.totalRobux.toLocaleString('id-ID') : 0} R$\`\n` +
                   `├ 💵 **Volume Belanja:** \`Rp ${userStats.totalSpent.toLocaleString('id-ID')}\`\n` +
                   `└ 📦 **Total Transaksi:** \`${userStats.totalOrders}x\``,
            inline: false
        });
    } else {
        embed.addFields({
            name: '👤 Peringkat Anda',
            value: `Anda belum terdaftar dalam periode **${timeframeText}** ini.`,
            inline: false
        });
    }

    return embed;
}

module.exports = { generateLeaderboardEmbed };
