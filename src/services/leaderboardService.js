const { EmbedBuilder } = require('discord.js');
const TopSpender = require('../models/TopSpender');
const LeaderboardState = require('../models/LeaderboardState');
const settingsService = require('./settingsService');
const logger = require('../utils/logger');

const LOG_CHANNEL_ID = '1534624789065498795';
const LEADERBOARD_CHANNEL_ID = '1473251746259402867';
const GUILD_ID = process.env.GUILD_ID || '1094611330603946054';

const TIER_ROLES = [
    { threshold: 100000000, roleId: '1534727116224987147', name: 'Tier 100M' },
    { threshold: 50000000, roleId: '1534727181643681994', name: 'Tier 50M' },
    { threshold: 20000000, roleId: '1534726079078596668', name: 'Tier 20M' },
    { threshold: 10000000, roleId: '1534725862371623114', name: 'Tier 10M' },
    { threshold: 5000000, roleId: '1534725543285493830', name: 'Tier 5M' },
    { threshold: 1000000, roleId: '1473325264208400630', name: 'Tier 1M' },
    { threshold: 500000, roleId: '1473324624875098325', name: 'Tier 500K' }
];

const ALL_TIER_ROLE_IDS = TIER_ROLES.map(t => t.roleId);

function calculateBadge(spending) {
    if (spending >= 10000000) return 'Eternal';
    if (spending >= 5000000) return 'Diamond';
    if (spending >= 2000000) return 'Gold';
    if (spending >= 500000) return 'Silver';
    return 'Bronze';
}

async function getBadgeEmoji(badgeStr) {
    return badgeStr.split(' ')[0];
}

async function addTransaction(userId, amount) {
    try {
        let spender = await TopSpender.findOne({ userId });
        if (!spender) {
            spender = new TopSpender({
                userId,
                totalSpending: 0,
                totalOrders: 0
            });
        }
        
        spender.totalSpending += amount;
        spender.totalOrders += 1;
        spender.lastPurchase = new Date();
        spender.customerBadge = calculateBadge(spender.totalSpending);
        
        await spender.save();
        return spender;
    } catch (err) {
        logger.error('[LeaderboardService] Error in addTransaction:', err);
    }
}

async function syncTransactionLogs(client) {
    try {
        logger.info('[LeaderboardService] Starting sync from Transaction Log...');
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) {
            logger.warn('[LeaderboardService] Log channel not found.');
            return;
        }

        let state = await LeaderboardState.findOne({ id: 'global' });
        if (!state) {
            state = new LeaderboardState({ id: 'global' });
        }

        let lastMessageId = state.lastSyncedMessageId;
        let hasMore = true;
        let totalSynced = 0;

        while (hasMore) {
            const options = { limit: 100 };
            if (lastMessageId) options.after = lastMessageId;

            const messages = await logChannel.messages.fetch(options).catch(() => new Map());
            if (messages.size === 0) {
                hasMore = false;
                break;
            }

            // Sort chronologically (oldest to newest)
            const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            for (const msg of sortedMessages) {
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
                                        await addTransaction(userId, amount);
                                        totalSynced++;
                                    }
                                }
                            }
                        }
                    }
                }
                lastMessageId = msg.id;
            }
            state.lastSyncedMessageId = lastMessageId;
            await state.save();
        }

        logger.info(`[LeaderboardService] Sync completed. Processed ${totalSynced} new transactions.`);
        await updateLeaderboard(client);
    } catch (err) {
        logger.error('[LeaderboardService] Error during syncTransactionLogs:', err);
    }
}

async function updateLeaderboard(client) {
    try {
        const state = await LeaderboardState.findOne({ id: 'global' });
        if (!state) return;

        const lbChannel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID).catch(() => null);
        if (!lbChannel) return;

        const topSpenders = await TopSpender.find()
            .sort({ totalSpending: -1 })
            .limit(10)
            .exec();

        let desc = 'Terima kasih kepada seluruh customer yang telah mempercayai LyraBlox.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n';

        const medals = ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'];

        for (let i = 0; i < topSpenders.length; i++) {
            const spender = topSpenders[i];
            const rankStr = medals[i];
            
            // Re-calculate badge and rank if needed
            spender.customerRank = i + 1;
            spender.customerBadge = calculateBadge(spender.totalSpending);
            await spender.save();

            const customerUser = await client.users.fetch(spender.userId).catch(() => null);
            const username = customerUser ? customerUser.username : `User-${spender.userId.slice(-4)}`;

            desc += `${rankStr} **${username}**  •  ${spender.customerBadge}\n`;
            desc += `> 💰 Total Belanja: **Rp ${spender.totalSpending.toLocaleString('id-ID')}**\n`;
            desc += `> 📦 Total Order: **${spender.totalOrders}x**\n\n`;
        }
        
        if (topSpenders.length === 0) {
            desc += '*Belum ada data transaksi.*\n\n';
        }

        desc += '━━━━━━━━━━━━━━━━━━━━━━\n\n';

        // Stats
        const totalCustomers = await TopSpender.countDocuments();
        const allSpenders = await TopSpender.find({}, 'totalSpending totalOrders');
        const totalRevenue = allSpenders.reduce((sum, s) => sum + s.totalSpending, 0);
        const totalOrders = allSpenders.reduce((sum, s) => sum + s.totalOrders, 0);

        desc += `📈 Total Customer: **${totalCustomers.toLocaleString('id-ID')}**\n`;
        desc += `💳 Total Revenue: **Rp ${totalRevenue.toLocaleString('id-ID')}**\n`;
        desc += `📦 Total Order: **${totalOrders.toLocaleString('id-ID')}**\n\n`;
        desc += `🔄 *Update Otomatis setiap transaksi SUCCESS*`;

        const embed = new EmbedBuilder()
            .setTitle('🏆 LYRABLOX | TOP SPENDER')
            .setDescription(desc)
            .setColor('#FFD700')
            .setTimestamp();

        if (state.leaderboardMessageId) {
            const msg = await lbChannel.messages.fetch(state.leaderboardMessageId).catch(() => null);
            if (msg) {
                await msg.edit({ embeds: [embed] });
                return;
            }
        }

        // If no message or message not found, send a new one
        const sentMsg = await lbChannel.send({ embeds: [embed] });
        state.leaderboardMessageId = sentMsg.id;
        await state.save();

    } catch (err) {
        logger.error('[LeaderboardService] Error during updateLeaderboard:', err);
    }
}

async function updateCustomerTier(client, userId) {
    try {
        const spender = await TopSpender.findOne({ userId });
        if (!spender) return; // No transactions yet

        const rolesToAdd = [];
        for (const tier of TIER_ROLES) {
            if (spender.totalSpending >= tier.threshold) {
                rolesToAdd.push(tier.roleId);
            }
        }
        
        const highestTier = rolesToAdd.length > 0 ? TIER_ROLES.find(t => t.roleId === rolesToAdd[0]) : null;

        const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return;

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return; // User not in server

        let newlyAddedHighestRole = false;
        
        for (const roleId of rolesToAdd) {
            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(roleId).catch(() => {});
                if (highestTier && roleId === highestTier.roleId) {
                    newlyAddedHighestRole = true;
                }
            }
        }

        if (newlyAddedHighestRole && highestTier) {
            // Send DM
            const dmEmbed = new EmbedBuilder()
                .setDescription(
                    '━━━━━━━━━━━━━━━━━━\n\n' +
                    '🎉 **Selamat!**\n\n' +
                    'Terima kasih telah menjadi pelanggan setia LyraBlox.\n\n' +
                    `Total pembelian Anda kini telah mencapai **${highestTier.name}**.\n` +
                    'Role Customer Anda telah diperbarui secara otomatis.\n\n' +
                    'Terima kasih atas kepercayaan Anda kepada LyraBlox.\n\n' +
                    '━━━━━━━━━━━━━━━━━━'
                )
                .setColor('#2ecc71');
                
            await member.send({ embeds: [dmEmbed] }).catch(() => {});
            logger.info(`[LeaderboardService] Upgraded user ${userId} to ${highestTier.name}`);
        }
    } catch (err) {
        logger.error(`[LeaderboardService] Error updating tier for user ${userId}:`, err);
    }
}

async function syncAllCustomerTiers(client) {
    try {
        logger.info('[LeaderboardService] Synchronizing all customer tiers...');
        const spenders = await TopSpender.find();
        
        for (const spender of spenders) {
            await updateCustomerTier(client, spender.userId);
            // Brief sleep to avoid rate limits
            await new Promise(r => setTimeout(r, 200));
        }
        
        logger.info(`[LeaderboardService] Synchronized tiers for ${spenders.length} customers.`);
    } catch (err) {
        logger.error('[LeaderboardService] Error syncing all customer tiers:', err);
    }
}

module.exports = {
    addTransaction,
    syncTransactionLogs,
    updateLeaderboard,
    updateCustomerTier,
    syncAllCustomerTiers
};
