const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Order = require('../../models/Order');
const ProductOrder = require('../../models/ProductOrder');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Menampilkan leaderboard pembelian Robux & Produk')
        .addStringOption(option =>
            option.setName('timeframe')
                .setDescription('Pilih rentang waktu leaderboard')
                .setRequired(false)
                .addChoices(
                    { name: 'Semua Waktu', value: 'alltime' },
                    { name: 'Harian', value: 'daily' },
                    { name: 'Minggu Ini', value: 'weekly' },
                    { name: 'Bulan Ini', value: 'monthly' }
                )
        ),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const timeframe = interaction.options.getString('timeframe') || 'alltime';
            const matchStage = {
                status: { $in: ['delivered', 'completed'] }
            };

            // Set up date filters
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
                const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday (starts week on Monday)
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

            if (leaderboard.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setTitle('🏆 WinterStore - Robux & Product Leaderboard')
                    .setDescription(`Belum ada data pembelian untuk periode **${timeframeText}**.`)
                    .setColor('#0099ff')
                    .setTimestamp();
                return await interaction.editReply({ embeds: [emptyEmbed] });
            }

            // Find executing user rank
            const userRankIndex = leaderboard.findIndex(entry => entry.userId === interaction.user.id);
            const userRank = userRankIndex !== -1 ? userRankIndex + 1 : null;
            const userStats = userRank !== null ? leaderboard[userRankIndex] : null;

            // Generate leaderboard list (top 10)
            const topTen = leaderboard.slice(0, 10);
            let description = `Berikut adalah peringkat pembeli terbanyak untuk periode **${timeframeText}**:\n\n`;

            description += topTen.map((entry, index) => {
                const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                const rankText = index < 10 ? rankEmojis[index] : `🏅`;
                const robloxText = entry.lastRobloxUsername ? ` (\`${entry.lastRobloxUsername}\`)` : '';
                return `${rankText} **#${index + 1} | <@${entry.userId}>**${robloxText}\n` +
                       `├ 💎 **Volume Robux:** \`${entry.totalRobux.toLocaleString('id-ID')} R$\`\n` +
                       `├ 💵 **Volume Belanja:** \`Rp ${entry.totalSpent.toLocaleString('id-ID')}\`\n` +
                       `└ 📦 **Total Transaksi:** \`${entry.totalOrders}x\``;
            }).join('\n───────────────────\n');

            const embed = new EmbedBuilder()
                .setTitle('🏆 WinterStore - Robux & Product Leaderboard')
                .setDescription(description)
                .setColor('#0099ff')
                .setFooter({ text: 'WinterStore Leaderboard System' })
                .setTimestamp();

            // Add personal rank
            if (userRank !== null && userStats) {
                embed.addFields({
                    name: '👤 Peringkat Anda',
                    value: `Peringkat **#${userRank}** dari **${leaderboard.length}** pembeli\n` +
                           `├ 💎 **Volume Robux:** \`${userStats.totalRobux.toLocaleString('id-ID')} R$\`\n` +
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

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error generating leaderboard:', error);
            await interaction.editReply('❌ Terjadi kesalahan saat memuat leaderboard.');
        }
    }
};
