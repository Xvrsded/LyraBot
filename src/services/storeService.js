const noblox = require('noblox.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const StoreConfig = require('../models/StoreConfig');

let isLoggedIn = false;

async function loginRoblox() {
    if (isLoggedIn) return true;
    if (!process.env.ROBLOX_COOKIE) {
        console.warn('⚠️ ROBLOX_COOKIE tidak disetel di .env, sistem cek saldo otomatis dinonaktifkan.');
        return false;
    }
    
    try {
        const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
        const name = currentUser.name || currentUser.UserName || 'User';
        console.log(`✅ Roblox Logged in as ${name}`);
        isLoggedIn = true;
        return true;
    } catch (error) {
        console.error('❌ Roblox Login Error:', error.message);
        return false;
    }
}

async function getRobuxBalance() {
    let personalAvailable = 'N/A';
    let groupAvailable = 'N/A';
    let pending = 'N/A';

    try {
        const loggedIn = await loginRoblox();
        if (loggedIn) {
            // Fetch user funds
            try {
                const user = await noblox.getAuthenticatedUser();
                if (user && user.id) {
                    personalAvailable = await noblox.getUserFunds(user.id);
                } else {
                    personalAvailable = 'Error';
                }
            } catch (err) {
                console.error('Error fetching User funds:', err.message);
                personalAvailable = 'Error';
            }

            // Fetch group funds
            if (process.env.GROUP_ID) {
                try {
                    const groupId = parseInt(process.env.GROUP_ID);
                    groupAvailable = await noblox.getGroupFunds(groupId);
                } catch (err) {
                    console.error('Error fetching Group funds:', err.message);
                    groupAvailable = 'No Access';
                }
            } else {
                groupAvailable = 'Not Set';
            }
        }
    } catch (error) {
        console.error('Error fetching Robux balance:', error.message);
    }

    return { personalAvailable, groupAvailable, pending };
}

async function updateStoreEmbed(client) {
    try {
        let configs = await StoreConfig.find();
        
        // Auto-create config untuk setiap guild jika belum ada
        const guilds = client.guilds.cache.values();
        for (const guild of guilds) {
            const exists = configs.find(c => c.guildId === guild.id);
            if (!exists) {
                const newConfig = new StoreConfig({ guildId: guild.id, stockChannelId: '1517541756105916486' });
                await newConfig.save();
                configs.push(newConfig);
                console.log(`[Store] Auto-created store config for guild ${guild.name}`);
            }
        }

        if (configs.length === 0) return;

        const balance = await getRobuxBalance();
        const currentPersonal = String(balance.personalAvailable);
        const currentGroup = String(balance.groupAvailable);
        const currentPending = String(balance.pending);

        for (const config of configs) {
            try {
                if (!config.stockChannelId) {
                    config.stockChannelId = '1517541756105916486';
                    await config.save();
                }

                const guild = client.guilds.cache.get(config.guildId);
                if (!guild) continue;

                const channel = guild.channels.cache.get(config.stockChannelId);
                if (!channel) continue;

                // Cek apakah saldo berubah
                const stockChanged = (config.lastPersonalAvailable !== currentPersonal || config.lastGroupAvailable !== currentGroup || config.lastPending !== currentPending);
                
                if (!stockChanged && config.messageId) {
                    try {
                        const existingMessage = await channel.messages.fetch(config.messageId);
                        if (existingMessage) {
                            console.log(`[Store] Stock unchanged. No update needed for guild ${config.guildId}.`);
                            continue; // Skip update if nothing changed and message exists
                        }
                    } catch (err) {
                        // Message might be deleted, so we continue to create a new one
                        console.log(`[Store] Pesan embed tidak ditemukan, akan dibuat ulang.`);
                    }
                } else if (stockChanged) {
                    console.log(`[Store] Stock changed! Personal: ${currentPersonal}, Group: ${currentGroup}, Pending: ${currentPending}`);
                    
                    const isInitialRun = (config.lastPersonalAvailable === null);
                    if (!isInitialRun) {
                        const alertChannelId = process.env.STOCK_ALERT_CHANNEL_ID || '1505266706841342063';
                        const alertChannel = guild.channels.cache.get(alertChannelId) || await guild.channels.fetch(alertChannelId).catch(() => null);
                        
                        if (alertChannel) {
                            const { EmbedBuilder } = require('discord.js');
                            
                            const oldPersonalVal = parseInt(config.lastPersonalAvailable);
                            const oldGroupVal = parseInt(config.lastGroupAvailable);
                            const newPersonalVal = parseInt(currentPersonal);
                            const newGroupVal = parseInt(currentGroup);
                            
                            const oldPersonal = isNaN(oldPersonalVal) ? 0 : oldPersonalVal;
                            const oldGroup = isNaN(oldGroupVal) ? 0 : oldGroupVal;
                            const newPersonal = isNaN(newPersonalVal) ? 0 : newPersonalVal;
                            const newGroup = isNaN(newGroupVal) ? 0 : newGroupVal;
                            
                            const isValidOldPersonal = config.lastPersonalAvailable !== null && config.lastPersonalAvailable !== 'Error';
                            const isValidNewPersonal = currentPersonal !== 'Error';
                            const isValidOldGroup = config.lastGroupAvailable !== null && config.lastGroupAvailable !== 'No Access' && config.lastGroupAvailable !== 'Error';
                            const isValidNewGroup = currentGroup !== 'No Access' && currentGroup !== 'Error';
                            
                            // Cek Personal Stock Change
                            if (isValidOldPersonal && isValidNewPersonal && oldPersonal !== newPersonal) {
                                const diff = newPersonal - oldPersonal;
                                const isRefill = diff > 0;
                                const alertEmbed = new EmbedBuilder()
                                    .setTitle(isRefill ? '📥 Stock Refill • Personal Robux' : '📤 Stock Sold • Personal Robux')
                                    .setDescription(isRefill 
                                        ? `💎 **Personal Robux Stock** telah ditambahkan!\n\n• Jumlah Refill: **+${diff.toLocaleString('id-ID')} R$**\n• Sisa Stok Sekarang: \`${newPersonal.toLocaleString('id-ID')} R$\``
                                        : `🛒 **Personal Robux Stock** telah berkurang!\n\n• Jumlah Berkurang: **${Math.abs(diff).toLocaleString('id-ID')} R$**\n• Sisa Stok Sekarang: \`${newPersonal.toLocaleString('id-ID')} R$\``
                                    )
                                    .setColor(isRefill ? '#00ff00' : '#ffaa00')
                                    .setTimestamp();
                                await alertChannel.send({ content: '@everyone', embeds: [alertEmbed] }).catch(console.error);
                            }
                            
                            // Cek Group Stock Change
                            if (isValidOldGroup && isValidNewGroup && oldGroup !== newGroup) {
                                const diff = newGroup - oldGroup;
                                const isRefill = diff > 0;
                                const alertEmbed = new EmbedBuilder()
                                    .setTitle(isRefill ? '📥 Stock Refill • Group Robux' : '📤 Stock Sold • Group Robux')
                                    .setDescription(isRefill 
                                        ? `🏢 **Group Robux Stock** telah ditambahkan!\n\n• Jumlah Refill: **+${diff.toLocaleString('id-ID')} R$**\n• Sisa Stok Sekarang: \`${newGroup.toLocaleString('id-ID')} R$\``
                                        : `🛒 **Group Robux Stock** telah berkurang!\n\n• Jumlah Berkurang: **${Math.abs(diff).toLocaleString('id-ID')} R$**\n• Sisa Stok Sekarang: \`${newGroup.toLocaleString('id-ID')} R$\``
                                    )
                                    .setColor(isRefill ? '#00ff00' : '#ffaa00')
                                    .setTimestamp();
                                await alertChannel.send({ content: '@everyone', embeds: [alertEmbed] }).catch(console.error);
                            }
                        }
                    }
                }

                let packageList = '';
                if (config.packages.length > 0) {
                    const sortedPackages = [...config.packages].sort((a, b) => a.amount - b.amount);
                    sortedPackages.forEach(pkg => {
                        packageList += `🔹 **${pkg.amount} Robux** = Rp ${pkg.price.toLocaleString('id-ID')}\n`;
                    });
                } else {
                    packageList = 'Belum ada paket yang tersedia.';
                }

                const embed = new EmbedBuilder()
                    .setTitle('🛒 WINTER STORE | PRICE LIST')
                    .setDescription('```\n╔═══════════════════╗\n    WINTER STORE    \n     PRICE LIST     \n╚═══════════════════╝\n```\nSelamat datang di WINTER STORE! Silakan lihat daftar paket harga dan ketentuan pembelian di bawah ini.')
                    .setColor('#0099ff')
                    .addFields(
                        { name: '💎 Personal Robux Stock', value: `\`${currentPersonal.toLocaleString('id-ID')} R$\``, inline: true },
                        { name: '🏢 Group Robux Stock', value: `\`${currentGroup.toLocaleString('id-ID')} R$\``, inline: true },
                        { name: '📋 Daftar Paket & Harga', value: packageList, inline: false },
                        { name: '💳 Payment Methods', value: '• Seabank\n• Dana\n• GoPay\n• ShopeePay', inline: true },
                        { name: '🛡️ Service Jaminan', value: '⚡ **Fast Process**\n🔒 **Trusted Seller**', inline: true },
                        { name: '⚠️ Syarat & Ketentuan (Requirements)', value: '1. **Pembayaran Wajib Di Awal**.\n2. Untuk orderan di atas **1,000 Robux** harus mengaktifkan **Verifikasi 2 Langkah (2FA)** terhadap akun masing-masing agar bisa menerima Robux hingga **10,000 Robux**.\n3. Jika akun belum melakukan verifikasi 2 langkah, batas harian akun hanya bisa menerima **500 Robux** dan **1,000 Robux** per bulan.\n4. **Diharapkan user mencantumkan username dengan benar**, karena kesalahan username bukan tanggung jawab admin.', inline: false }
                    )
                    .setFooter({ text: `Last Update: ${new Date().toLocaleString('id-ID')}` })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('store_order').setLabel('🛒 Order Robux').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('store_packages').setLabel('📋 Lihat Paket').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('store_refresh').setLabel('💰 Refresh Stock').setStyle(ButtonStyle.Success)
                );

                let messageCreatedOrUpdated = false;

                if (config.messageId) {
                    try {
                        const message = await channel.messages.fetch(config.messageId);
                        if (message) {
                            await message.edit({ embeds: [embed], components: [row] });
                            console.log(`[Store] Embed updated for guild ${config.guildId}`);
                            messageCreatedOrUpdated = true;
                        }
                    } catch (err) {
                        console.log(`[Store] Pesan embed terhapus di guild ${config.guildId}, membuat ulang...`);
                    }
                }

                if (!messageCreatedOrUpdated) {
                    const newMessage = await channel.send({ embeds: [embed], components: [row] });
                    config.messageId = newMessage.id;
                    console.log(`[Store] Embed created for guild ${config.guildId}`);
                }

                config.lastPersonalAvailable = currentPersonal;
                config.lastGroupAvailable = currentGroup;
                config.lastPending = currentPending;
                config.lastUpdate = new Date();
                await config.save();

            } catch (err) {
                console.error(`[Store] Error updating embed for guild ${config.guildId}:`, err);
            }
        }
    } catch (error) {
        console.error('[Store] Error in updateStoreEmbed:', error);
    }
}

module.exports = {
    loginRoblox,
    getRobuxBalance,
    updateStoreEmbed
};
