const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Order = require('../models/Order');
const ProductOrder = require('../models/ProductOrder');
const User = require('../models/User');

const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function getWibDate(dateStr) {
    // Current UTC time
    const now = dateStr ? new Date(dateStr) : new Date();
    // Convert to WIB string
    const wibString = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    return new Date(wibString);
}

function getWibStartOf(period) {
    const targetWib = getWibDate();
    
    if (period === 'daily') {
        targetWib.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
        const day = targetWib.getDay();
        const diff = targetWib.getDate() - day + (day === 0 ? -6 : 1);
        targetWib.setDate(diff);
        targetWib.setHours(0, 0, 0, 0);
    } else if (period === 'monthly') {
        targetWib.setDate(1);
        targetWib.setHours(0, 0, 0, 0);
    }
    
    // Construct UTC Date that corresponds to the targetWib local time (WIB is UTC+7)
    return new Date(Date.UTC(
        targetWib.getFullYear(),
        targetWib.getMonth(),
        targetWib.getDate(),
        targetWib.getHours() - 7,
        targetWib.getMinutes(),
        targetWib.getSeconds(),
        targetWib.getMilliseconds()
    ));
}

function getFormattedDateWib(period) {
    const nowWib = getWibDate();
    const d = nowWib.getDate();
    const m = monthNames[nowWib.getMonth()];
    const y = nowWib.getFullYear();
    
    if (period === 'daily') {
        return `${d} ${m} ${y}`;
    } else if (period === 'monthly') {
        return `${m} ${y}`;
    } else if (period === 'weekly') {
        const targetWib = getWibDate();
        const day = targetWib.getDay();
        const diff = targetWib.getDate() - day + (day === 0 ? -6 : 1);
        targetWib.setDate(diff);
        const d1 = targetWib.getDate();
        const m1 = monthNames[targetWib.getMonth()];
        const y1 = targetWib.getFullYear();
        
        const endWib = new Date(targetWib);
        endWib.setDate(endWib.getDate() + 6);
        const d2 = endWib.getDate();
        const m2 = monthNames[endWib.getMonth()];
        const y2 = endWib.getFullYear();
        
        return `${d1} ${m1} ${y1} — ${d2} ${m2} ${y2}`;
    }
    return 'ALL TIME';
}

async function generateLeaderboardEmbed(interactionUser, timeframe = 'alltime') {
    const matchStage = {
        status: { $in: ['delivered', 'completed'] }
    };

    let periodHeader = 'ALL TIME';
    let dateStr = '';

    if (timeframe === 'daily') {
        matchStage.createdAt = { $gte: getWibStartOf('daily') };
        periodHeader = '📅 HARIAN';
        dateStr = getFormattedDateWib('daily');
    } else if (timeframe === 'weekly') {
        matchStage.createdAt = { $gte: getWibStartOf('weekly') };
        periodHeader = '📆 MINGGUAN';
        dateStr = getFormattedDateWib('weekly');
    } else if (timeframe === 'monthly') {
        matchStage.createdAt = { $gte: getWibStartOf('monthly') };
        periodHeader = '🗓️ BULANAN';
        dateStr = getFormattedDateWib('monthly');
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

    const embed = new EmbedBuilder()
        .setTitle(`🏆 LYRA BLOX LEADERBOARD`)
        .setColor('#0099ff')
        .setFooter({ text: 'LyraBlox Leaderboard System' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('leaderboard_alltime').setLabel('🏆 All Time').setStyle(timeframe === 'alltime' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('leaderboard_daily').setLabel('📅 Harian').setStyle(timeframe === 'daily' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('leaderboard_weekly').setLabel('📆 Mingguan').setStyle(timeframe === 'weekly' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('leaderboard_monthly').setLabel('🗓️ Bulanan').setStyle(timeframe === 'monthly' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    if (leaderboard.length === 0) {
        embed.setDescription(`**${periodHeader}**\n${dateStr}\n\n📊 Belum ada transaksi pada periode ini.`);
        return { embed, row };
    }

    const topTen = leaderboard.slice(0, 10);
    let description = `**${periodHeader}**\n${dateStr}\n\n`;

    description += topTen.map((entry, index) => {
        const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const rankText = index < 10 ? rankEmojis[index] : `🏅`;
        const robloxText = entry.lastRobloxUsername ? ` (\`${entry.lastRobloxUsername}\`)` : '';
        return `${rankText} **<@${entry.userId}>**${robloxText}\n` +
               `└ Rp ${entry.totalSpent.toLocaleString('id-ID')}`;
    }).join('\n\n');

    embed.setDescription(description);

    // Include the buttons so they stay at the bottom of the public message
    return { embed, row };
}

module.exports = { generateLeaderboardEmbed, getWibStartOf, getFormattedDateWib, getWibDate };
