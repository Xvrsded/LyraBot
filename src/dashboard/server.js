const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const RobuxPackage = require('../models/RobuxPackage');
const LedgerEntry = require('../models/LedgerEntry');
const settingsService = require('../services/settingsService');
const logger = require('../utils/logger');

let discordClient = null;

function startDashboardServer(client) {
    discordClient = client;
    const app = express();
    const port = process.env.PORT || 3000;
    const jwtSecret = process.env.JWT_SECRET || 'lyrablox-secret-key-999';

    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    // Auth Route
    app.post('/api/auth/login', (req, res) => {
        const { username, password } = req.body;
        const configUser = process.env.DASHBOARD_USERNAME || 'admin';
        const configPass = process.env.DASHBOARD_PASSWORD || 'lyrablox123';

        if (username === configUser && password === configPass) {
            const token = jwt.sign({ username }, jwtSecret, { expiresIn: '7d' });
            return res.json({ success: true, token });
        }
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    });

    // Auth Middleware
    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return res.status(401).json({ success: false, message: 'Access token required.' });

        jwt.verify(token, jwtSecret, (err, user) => {
            if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
            req.user = user;
            next();
        });
    };

    // Statistics Endpoint
    app.get('/api/stats', authenticateToken, async (req, res) => {
        try {
            const totalOrders = await Order.countDocuments();
            const completedOrders = await Order.countDocuments({ status: 'success' });
            const pendingOrders = await Order.countDocuments({ status: 'pending' });

            const revenueResult = await Order.aggregate([
                { $match: { status: 'success' } },
                { $group: { _id: null, total: { $sum: '$price' } } }
            ]);
            const revenue = revenueResult[0]?.total || 0;

            const totalTickets = await Ticket.countDocuments();
            const activeTickets = await Ticket.countDocuments({ status: 'open' });

            const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(10);

            res.json({
                success: true,
                stats: {
                    totalOrders,
                    completedOrders,
                    pendingOrders,
                    revenue,
                    totalTickets,
                    activeTickets
                },
                recentOrders
            });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Safe Refresh Server Endpoint
    app.post('/api/refresh', authenticateToken, async (req, res) => {
        try {
            logger.info('[Dashboard] Admin triggered safe server refresh');
            // 1. Reload configuration from database
            const configService = require('../services/configService');
            // Force refresh of packages and MM fees in cache
            if (configService.getProductPackages) {
                await configService.getProductPackages('visend', true);
                await configService.getProductPackages('vilog', true);
                await configService.getProductPackages('gig', true);
                await configService.getProductPackages('copay', true);
                await configService.getProductPackages('custom', true);
            }
            if (configService.getMMFees) {
                await configService.getMMFees(true);
            }
            if (configService.getGlobalConfig) {
                const guildId = process.env.GUILD_ID || '1094611330603946054';
                await configService.getGlobalConfig(guildId, true);
            }

            // 2. Sync Voice Status
            const voiceStatusService = require('../services/voiceStatusService');
            if (voiceStatusService.updateAllVoiceStatuses && discordClient) {
                voiceStatusService.updateAllVoiceStatuses(discordClient);
            }
            
            res.json({ success: true, message: 'Server configuration refreshed safely.' });
        } catch (err) {
            logger.error('[Dashboard] Error during server refresh:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Products CRUD Endpoint
    app.get('/api/products', authenticateToken, async (req, res) => {
        try {
            const products = await Product.find().sort({ createdAt: -1 });
            res.json({ success: true, products });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/products', authenticateToken, async (req, res) => {
        try {
            const product = new Product(req.body);
            await product.save();
            res.json({ success: true, product });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.put('/api/products/:id', authenticateToken, async (req, res) => {
        try {
            const product = await Product.findByIdAndUpdate(req.id || req.params.id, req.body, { new: true });
            res.json({ success: true, product });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.delete('/api/products/:id', authenticateToken, async (req, res) => {
        try {
            await Product.findByIdAndDelete(req.id || req.params.id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Robux Packages CRUD
    app.get('/api/robux-packages', authenticateToken, async (req, res) => {
        try {
            const packages = await RobuxPackage.find().sort({ sortOrder: 1, amount: 1 });
            res.json({ success: true, packages });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/robux-packages', authenticateToken, async (req, res) => {
        try {
            const pkg = new RobuxPackage(req.body);
            await pkg.save();
            res.json({ success: true, package: pkg });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.put('/api/robux-packages/:id', authenticateToken, async (req, res) => {
        try {
            const pkg = await RobuxPackage.findByIdAndUpdate(req.params.id, req.body, { new: true });
            res.json({ success: true, package: pkg });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.delete('/api/robux-packages/:id', authenticateToken, async (req, res) => {
        try {
            await RobuxPackage.findByIdAndDelete(req.params.id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Pricing rates endpoint (quick edit)
    app.get('/api/pricing', authenticateToken, async (req, res) => {
        try {
            const robuxProducts = await Product.find({ pricingType: 'PER_ROBUX' });
            res.json({ success: true, products: robuxProducts });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.put('/api/pricing', authenticateToken, async (req, res) => {
        try {
            const updates = req.body; // Array of { id, price }
            for (const item of updates) {
                await Product.findByIdAndUpdate(item.id, { price: item.price });
            }
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Orders Endpoint
    app.get('/api/orders', authenticateToken, async (req, res) => {
        try {
            const orders = await Order.find().sort({ createdAt: -1 });
            res.json({ success: true, orders });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
        try {
            const orderId = req.params.id;
            const { status } = req.body;
            
            const order = await Order.findOne({ orderId });
            if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

            if (order.status !== 'pending' && order.status !== 'paid') {
                return res.status(400).json({ success: false, message: 'Only active pending/paid orders can be updated.' });
            }

            if (status === 'cancelled') {
                await Order.deleteOne({ orderId: order.orderId });
            } else if (status === 'completed') {
                order.status = 'success';
                await order.save();
            } else {
                order.status = status;
                await order.save();
            }

            // Update Voice Status
            if (discordClient) {
                const voiceStatusService = require('../services/voiceStatusService');
                voiceStatusService.updateAllVoiceStatuses(discordClient);
            }

            // Find ticket and set closed if completing
            if (status === 'completed' || status === 'cancelled') {
                await Ticket.findOneAndUpdate({ orderId: order.orderId }, { status: 'closed' });
                // We can DM user and log as well if Discord is running
                if (discordClient) {
                    const brandingName = await settingsService.get('branding_name', 'LyraBlox');
                    // Find ticket channel and clean up
                    const channel = discordClient.channels.cache.get(order.channelId);
                    if (channel) {
                        try {
                            const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
                            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
                            const originalMsg = messages?.find(m => m.author.id === discordClient.user.id && m.embeds.length > 0);
                            
                            if (originalMsg) {
                                const oldEmbed = originalMsg.embeds[0];
                                const isComplete = status === 'completed';
                                const newEmbed = EmbedBuilder.from(oldEmbed)
                                    .setColor(isComplete ? '#00ff00' : '#ff0000')
                                    .setDescription(
                                        oldEmbed.description
                                            .replace(/🟡 Pending/i, isComplete ? '✅ Success' : '🔴 Cancelled')
                                            .replace(/🟢 Paid/i, isComplete ? '✅ Success' : '🔴 Cancelled')
                                    );

                                const closeBtn = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                                );
                                await originalMsg.edit({ embeds: [newEmbed], components: [closeBtn] });
                            }

                            if (status === 'completed') {
                                await channel.send('✅ **Dashboard Admin:** Pesanan ditandai selesai dari Dashboard. Tiket akan ditutup dalam 60 detik.');
                                setTimeout(() => { channel.delete().catch(() => {}); }, 60000);
                            } else {
                                await channel.send('❌ **Dashboard Admin:** Pesanan dibatalkan dari Dashboard. Tiket akan ditutup dalam 10 detik.');
                                setTimeout(() => { channel.delete().catch(() => {}); }, 10000);
                            }
                        } catch (e) {
                            logger.warn('Failed to edit ticket channel or close from dashboard request:', e.message);
                        }
                    }

                    // Send DM
                    try {
                        const customer = await discordClient.users.fetch(order.userId);
                        if (customer) {
                            let dmMsg = '';
                            if (status === 'completed') {
                                dmMsg = `🎉 **Pesanan Anda telah berhasil diproses!**\n\n` +
                                        `📦 **Order ID:** ${order.orderId}\n` +
                                        `🛍️ **Produk:** ${order.productName}\n` +
                                        `💵 **Total Pembayaran:** Rp ${order.price.toLocaleString('id-ID')}\n\n` +
                                        `Terima kasih telah mempercayai **${brandingName}**.\n` +
                                        `Kami berharap dapat melayani Anda kembali! ✨`;
                            } else {
                                dmMsg = `❌ **Pesanan Anda telah dibatalkan.**\n\n` +
                                        `📦 **Order ID:** ${order.orderId}\n` +
                                        `🛍️ **Produk:** ${order.productName}\n\n` +
                                        `Jika ada pertanyaan, silakan hubungi admin di server **${brandingName}**.`;
                            }
                            await customer.send(dmMsg);
                        }
                    } catch (e) {
                        logger.warn(`Failed to DM customer ${order.userId}:`, e.message);
                    }

                    // Log to Log Channel ONLY on success
                    if (status === 'completed') {
                        const logChannelId = await settingsService.get('log_channel_id', '1534624789065498795');
                        const logChannel = logChannelId ? await discordClient.channels.fetch(logChannelId).catch(() => null) : null;
                        if (logChannel) {
                            const customer = await discordClient.users.fetch(order.userId).catch(() => null);
                            const avatarURL = customer ? customer.displayAvatarURL({ dynamic: true, size: 256 }) : discordClient.user.defaultAvatarURL;

                            // Extract robux packet/amount if present
                            let robuxPaket = '-';
                            if (order.details) {
                                const pKey = Object.keys(order.details).find(k => k.toLowerCase().includes('amount') || k.toLowerCase().includes('qty') || k.toLowerCase().includes('paket') || k.toLowerCase().includes('robux'));
                                if (pKey) robuxPaket = order.details[pKey];
                            }

                            // Format time in WIB
                            const now = new Date();
                            const timeStr = now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }) +
                                            '\n' + now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }) + ' WIB';

                            const logEmbed = new EmbedBuilder()
                                .setTitle('🧾 Transaction Completed')
                                .setDescription('Pesanan telah berhasil diproses oleh Staff LyraBlox.\n━━━━━━━━━━━━━━━━━━━━━━')
                                .setThumbnail(avatarURL)
                                .addFields(
                                    { name: '👤 Customer', value: `<@${order.userId}>`, inline: true },
                                    { name: '👨‍💼 Staff', value: 'Dashboard Admin', inline: true },
                                    { name: '\u200b', value: '\u200b', inline: true },
                                    { name: '📦 Produk', value: order.productName, inline: true },
                                    { name: '🎁 Paket', value: `${robuxPaket}`, inline: true },
                                    { name: '\u200b', value: '\u200b', inline: true },
                                    { name: '💰 Total', value: `Rp ${order.price.toLocaleString('id-ID')}`, inline: true },
                                    { name: '📌 Status', value: '✅ Success', inline: true },
                                    { name: '\u200b', value: '\u200b', inline: true },
                                    { name: '🆔 Order ID', value: `\`${order.orderId}\``, inline: true },
                                    { name: '🕒 Waktu', value: timeStr, inline: true },
                                    { name: '\u200b', value: '\u200b', inline: true }
                                )
                                .setFooter({ text: 'LyraBlox • Transaction Log' })
                                .setColor('#2ecc71')
                                .setTimestamp();

                            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                            
                            // Update Leaderboard
                            try {
                                const leaderboardService = require('../services/leaderboardService');
                                await leaderboardService.addTransaction(order.userId, order.price);
                                await leaderboardService.updateLeaderboard(client);
                                await leaderboardService.updateCustomerTier(client, order.userId);
                            } catch (err) {
                                console.error('[Server.js] Error updating leaderboard:', err);
                            }
                        }
                    }
                }
            }

            res.json({ success: true, order });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Settings Endpoint
    app.get('/api/settings', authenticateToken, async (req, res) => {
        try {
            const settings = await settingsService.getAll();
            res.json({ success: true, settings });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.put('/api/settings', authenticateToken, async (req, res) => {
        try {
            const settings = req.body; // key-value pairs
            for (const [key, value] of Object.entries(settings)) {
                await settingsService.set(key, value);
            }

            // Real-time synchronization for LyraBlox Control Center V2 Statuses
            let needsDashboardUpdate = false;
            const StoreSetting = require('../models/StoreSetting');
            const storeSetting = await StoreSetting.findOne() || await StoreSetting.create({});

            for (const [key, value] of Object.entries(settings)) {
                if (key === 'products.robux_login.enabled') {
                    if (!storeSetting.products) storeSetting.products = {};
                    if (!storeSetting.products.robux_login) storeSetting.products.robux_login = {};
                    storeSetting.products.robux_login.enabled = (value === 'true' || value === true || value === 1 || value === '1');
                    needsDashboardUpdate = true;
                } else if (key === 'products.robux_send.enabled') {
                    if (!storeSetting.products) storeSetting.products = {};
                    if (!storeSetting.products.robux_send) storeSetting.products.robux_send = {};
                    storeSetting.products.robux_send.enabled = (value === 'true' || value === true || value === 1 || value === '1');
                    needsDashboardUpdate = true;
                } else if (key === 'products.gift_in_game.enabled') {
                    if (!storeSetting.products) storeSetting.products = {};
                    if (!storeSetting.products.gift_in_game) storeSetting.products.gift_in_game = {};
                    storeSetting.products.gift_in_game.enabled = (value === 'true' || value === true || value === 1 || value === '1');
                    needsDashboardUpdate = true;
                }
            }

            if (needsDashboardUpdate) {
                storeSetting.markModified('products');
                await storeSetting.save();
                console.log('[Dashboard API] Saved new product settings to StoreSetting.');
                
                if (discordClient) {
                    const { buildDashboardMessage } = require('../services/storeService');
                    // Hardcoded target channel ID: 1534577487852601384
                    const channel = await discordClient.channels.fetch('1534577487852601384').catch(() => null);
                    if (channel && storeSetting.dashboardMessageId) {
                        const message = await channel.messages.fetch(storeSetting.dashboardMessageId).catch(() => null);
                        if (message) {
                            const newPayload = await buildDashboardMessage(discordClient);
                            await message.edit(newPayload).catch(() => {});
                        }
                    }
                }
            }

            // Always update Voice Statuses if discord client is available, because rate/stock/payout might have changed
            if (discordClient) {
                const voiceStatusService = require('../services/voiceStatusService');
                console.log('[Dashboard API] Calling updateAllVoiceStatuses...');
                await voiceStatusService.updateAllVoiceStatuses(discordClient);
                console.log('[Dashboard API] Finished updateAllVoiceStatuses.');
            }

            res.json({ success: true });
        } catch (err) {
            console.error('[Dashboard API Error]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Deploy Panels manually from Dashboard
    app.post('/api/sync', authenticateToken, async (req, res) => {
        try {
            if (!discordClient) {
                return res.status(500).json({ success: false, message: 'Discord bot client is not connected.' });
            }

            const guildId = await settingsService.get('guild_id');
            if (!guildId) {
                return res.status(400).json({ success: false, message: 'Guild ID is not configured in settings.' });
            }

            const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
            if (!guild) {
                return res.status(400).json({ success: false, message: 'Guild not found or bot has no access.' });
            }

            const activeProducts = await Product.find({ active: true });
            let success = 0;

            for (const product of activeProducts) {
                if (!product.channelId) continue;
                const channel = await guild.channels.fetch(product.channelId).catch(() => null);
                if (!channel) continue;

                // Clean old
                try {
                    const messages = await channel.messages.fetch({ limit: 30 });
                    const oldMsg = messages.filter(m => 
                        m.author.id === discordClient.user.id && 
                        m.components.some(row => 
                            row.components.some(c => c.customId === `buy_product_${product._id}`)
                        )
                    );
                    for (const m of oldMsg.values()) {
                        await m.delete().catch(() => {});
                    }
                } catch (e) {}

                // Send new
                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle(product.embed.title || product.name)
                    .setDescription(product.embed.description || product.description)
                    .setColor(product.embed.color || '#0099ff')
                    .setFooter({ text: product.embed.footer || 'LyraBlox Store' })
                    .setTimestamp();

                if (product.embed.thumbnail) embed.setThumbnail(product.embed.thumbnail);
                if (product.embed.banner) embed.setImage(product.embed.banner);

                if (product.pricingType === 'PER_ROBUX') {
                    embed.addFields({ name: '💎 Rate Payout', value: `Rp ${product.price.toLocaleString('id-ID')} / Robux` });
                } else {
                    embed.addFields({ name: '💵 Harga', value: `Rp ${product.price.toLocaleString('id-ID')}` });
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`buy_product_${product._id}`)
                        .setLabel(product.button.label || 'Beli')
                        .setEmoji(product.button.emoji || '🛒')
                        .setStyle(ButtonStyle.Success)
                );

                await channel.send({ embeds: [embed], components: [row] });
                success++;
            }

            res.json({ success: true, message: `Successfully synced ${success} panels.` });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/sync-vilog', authenticateToken, async (req, res) => {
        try {
            const { syncVilogPanel } = require('../services/vilogService');
            await syncVilogPanel(discordClient);
            res.json({ success: true, message: 'Successfully synced Robux Via Login pricelist panel.' });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // Fallback to dashboard SPA
    app.use((req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.listen(port, () => {
        logger.info(`🌐 Web Dashboard running on port ${port}`);
    });
}

module.exports = startDashboardServer;
