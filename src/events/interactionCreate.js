const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const Product = require('../models/Product');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const CopayEligibility = require('../models/CopayEligibility');
const ReviewStats = require('../models/ReviewStats');
const RobuxPackage = require('../models/RobuxPackage');
const settingsService = require('../services/settingsService');
const logger = require('../utils/logger');
const noblox = require('noblox.js');
const { getRobloxUserInfo } = require('../services/robloxService');
const { getStoreSetting, buildDashboardMessage } = require('../services/storeService');
const activeClosures = new Set();

function buildReviewPanel(orderId) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`vouch_star_1_${orderId}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`vouch_star_2_${orderId}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`vouch_star_3_${orderId}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`vouch_star_4_${orderId}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`vouch_star_5_${orderId}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
    );
    const embed = new EmbedBuilder()
        .setTitle('⭐ Berikan Penilaian')
        .setDescription('Bagaimana pengalaman Anda berbelanja di LyraBlox?\n\nSilakan berikan rating Anda di bawah ini! 💖')
        .setColor('#ffd700');
    return { embeds: [embed], components: [row] };
}

async function createTicketFromSession(interaction, session, client) {
    try {
        // Sequential Order ID (Safe against deletions)
        const lastOrder = await Order.findOne().sort({ _id: -1 });
        let nextNumber = 1;
        if (lastOrder && lastOrder.orderId) {
            const match = lastOrder.orderId.match(/\d+/);
            if (match) nextNumber = parseInt(match[0], 10) + 1;
        }
        
        // Ensure uniqueness by checking if the generated ID already exists (in case of race conditions)
        let orderId = `LB-${String(nextNumber).padStart(6, '0')}`;
        while (await Order.exists({ orderId })) {
            nextNumber++;
            orderId = `LB-${String(nextNumber).padStart(6, '0')}`;
        }

        // Determine Category
        const categoryKey = session.type === 'gig' ? 'gig_category_id' : (session.type === 'visend' ? 'visend_category_id' : (session.type === 'copay' ? 'copay_category_id' : 'vilog_category_id'));
        let categoryId = await settingsService.get(categoryKey);
        if (!categoryId) {
            categoryId = await settingsService.get('global_ticket_category_id');
        }
        const categoryChannel = categoryId ? await interaction.guild.channels.fetch(categoryId).catch(() => null) : null;

        // Permissions
        const staffRoleId = await settingsService.get('staff_role_id');
        const adminRoleId = await settingsService.get('admin_role_id');
        const ownerRoleId = await settingsService.get('owner_role_id');

        const permissions = [
            { id: interaction.guild.id, deny: ['ViewChannel'] },
            { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
            { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] }
        ];

        if (staffRoleId) permissions.push({ id: staffRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
        if (adminRoleId && adminRoleId !== staffRoleId) permissions.push({ id: adminRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
        if (ownerRoleId && ownerRoleId !== staffRoleId && ownerRoleId !== adminRoleId) permissions.push({ id: ownerRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });

        const isGIG = session.type === 'gig';
        const isVisend = session.type === 'visend';
        
        const isCopay = session.type === 'copay';
        const isMM = session.type === 'mm_rekber';
        const isLimited = session.type === 'limited';
        const isBoost = session.type.startsWith('boost_');
        
        let productName = isGIG ? 'Gift In Game' : (isVisend ? 'Robux Via Send' : (isCopay ? 'Robux Gamepass (Pending 5 Hari)' : (isMM ? 'MM / Rekber' : (isLimited ? 'Limited Item' : 'Robux Via Login'))));
        if (isBoost) {
            productName = session.type === 'boost_fishit' ? 'Boost Fishit' : 'Boost Kalb';
        }
        const amountDisplay = session.amount;

        // Create Ticket Channel
        const channelPrefix = isBoost ? 'boost' : (isGIG ? 'gig' : (isVisend ? 'visend' : (isCopay ? 'copay' : (isMM ? 'mm' : (isLimited ? 'limited' : 'vilog')))));
        const channelName = (isMM || isLimited || isBoost) ? `${channelPrefix}-${interaction.user.username}` : `${channelPrefix}-${amountDisplay}r-${interaction.user.username}`;
        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: 0, // GuildText
            parent: categoryChannel ? categoryChannel.id : null,
            permissionOverwrites: permissions
        });

        // Create DB Records
        try {
            await Order.create({
                orderId,
                userId: interaction.user.id,
                productName,
                price: session.price,
                subtotal: session.price,
                rounding: 0,
                status: 'pending',
                channelId: channel.id,
            details: isMM ? {
                buyer: session.buyer,
                seller: session.seller,
                item: session.item,
                notes: session.notes,
                selectedRange: session.selectedRange,
                fee: session.fee
            } : (isGIG ? {
                gamepassName: session.gamepassName,
                amount: session.amount,
                price: session.price,
                rate: session.rate,
                robloxUsername: session.robloxUsername
            } : (isCopay ? {
                username: session.robloxUsername,
                amount: session.amount,
                price: session.price
            } : (isLimited ? {
                username: session.robloxUsername,
                item: session.item,
                price: session.price,
                notes: session.notes
            } : (isBoost ? {
                username: session.robloxUsername,
                password: session.robloxPassword,
                package: session.packageLabel,
                price: session.price
            } : {
                username: session.robloxUsername,
                password: session.robloxPassword,
                amount: session.amount,
                price: session.price,
                package: session.isCustom ? 'Custom' : undefined
            })))),
            snapshot: {
                productType: session.type,
                productName: productName,
                amount: session.amount || null,
                package: session.packageLabel || null,
                price: session.price,
                fee: session.fee || null,
                selectedRange: session.selectedRange || null,
                rate: session.rate || null,
                pricingType: session.isCustom ? 'custom' : 'normal',
                timestamp: Date.now()
            }
        });

        await Ticket.create({
            ticketId: channel.id,
            ownerId: interaction.user.id,
            productName,
            orderId,
            status: 'open'
        });
        } catch (e) {
            await channel.delete().catch(()=>{});
            throw e;
        }

        // Update Voice Status
        const voiceStatusService = require('../services/voiceStatusService');
        voiceStatusService.updateAllVoiceStatuses(interaction.client);
        const { AttachmentBuilder } = require('discord.js');
        const path = require('path');
        const qrPath = path.join(__dirname, '../../Public/LyraPayment.jpg');
        const qrFilename = `qris_${Date.now()}.jpg`;
        const qrAttachment = new AttachmentBuilder(qrPath, { name: qrFilename });

        let ticketEmbed = new EmbedBuilder()
            .setTitle('🔍 Konfirmasi Pemesanan Robux')
            .setDescription(`Halo <@${interaction.user.id}>, silakan selesaikan pembayaran ke QRIS di bawah ini untuk melanjutkan pesanan Anda.\n\n━━━━━━━━━━━━━━━━━━\n\n👤 **Informasi Akun**\n• **Username:** \`${session.robloxUsername}\`\n• **Display Name:** \`${session.displayName}\`\n• **User ID:** \`${session.robloxId}\`\n\n📦 **Informasi Pesanan**\n• **Produk:** \`${isVisend ? 'Robux Via Send' : 'Robux Via Login'}\`\n• **Jumlah Robux:** \`${session.amount} Robux\`\n• **Total Harga:** \`Rp${session.price.toLocaleString('id-ID')}\`\n\n━━━━━━━━━━━━━━━━━━\n⚠️ *Harap pastikan semua data di atas sudah benar sebelum melakukan pembayaran.*`)
            .setColor('#2ecc71')

            .setFooter({ text: 'Sistem Tiket Otomatis' })
            .setTimestamp();
        
        if (isGIG) {
            ticketEmbed = new EmbedBuilder()
                .setTitle('🛒 Pesanan LyraBlox')
                .setDescription(
                    `Halo <@${interaction.user.id}>,\n\n` +
                    `Terima kasih telah menggunakan layanan Gift In Game LyraBlox.\n` +
                    `Pesanan Anda berhasil dibuat.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📦 **Detail Pesanan**`
                )
                .setColor('#f43f5e')
                .addFields(
                    { name: '📦 Produk', value: 'Gift In Game', inline: true },
                    { name: '🎮 Game / Map', value: `\`\`\`text\n${session.gameLink || '-'}\n\`\`\``, inline: true },
                    { name: '🎁 Gamepass', value: `\`\`\`text\n${session.gamepassName || '-'}\n\`\`\``, inline: true },
                    { name: '💎 Harga Gamepass', value: `\`${session.amount.toLocaleString('id-ID')} Robux\``, inline: true },
                    { name: '💰 Total Pembayaran', value: `\`Rp ${session.price.toLocaleString('id-ID')}\``, inline: true },
                    { name: '👤 Username', value: `\`${session.robloxUsername}\``, inline: true },
                    { name: '📌 Status', value: '🟡 Pending', inline: true },
                    { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                    { name: '💳 Pembayaran', value: `Silakan lakukan pembayaran sesuai dengan total yang tertera di atas.\n\n🟦 **GoPay**\n\`081393625527\``, inline: false },
                    { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                    { 
                        name: '📝 Catatan Pembayaran', 
                        value: 
                            '• Maksimal pembayaran melalui QRIS adalah Rp500.000 untuk setiap transaksi.\n' +
                            '• Untuk transaksi di atas Rp500.000, silakan lakukan pembayaran lebih dari satu kali, atau gunakan satu kali pembayaran dengan tambahan biaya QRIS sebesar 0,3%.\n' +
                            '• Apabila melakukan transfer ke GoPay menggunakan Bank atau E-Wallet selain GoPay, akan dikenakan biaya tambahan sebesar Rp1.000 sesuai ketentuan penyedia layanan.\n' +
                            '• Pastikan nominal pembayaran sesuai dengan total yang tertera pada Ticket.\n' +
                            '• Setelah pembayaran selesai, kirim bukti transfer langsung pada Ticket ini.\n' +
                            '• Mohon tunggu hingga Staff memverifikasi pembayaran Anda secara manual.',
                        inline: false 
                    }
                )
    
                .setTimestamp();
        } else if (isMM) {
            ticketEmbed = new EmbedBuilder()
                .setTitle('🛒 Pesanan LyraBlox')
                .setDescription(
                    `Halo <@${interaction.user.id}>,\n\n` +
                    `Terima kasih telah menggunakan layanan MM / Rekber LyraBlox.\n` +
                    `Pesanan Anda berhasil dibuat.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📦 **Detail Transaksi**`
                )
                .setColor('#f59e0b')
                .addFields(
                    { name: 'Kategori', value: 'MM / Rekber', inline: true },
                    { name: 'Buyer', value: `\`${session.buyer}\``, inline: true },
                    { name: 'Seller', value: `\`${session.seller}\``, inline: true },
                    { name: 'Barang / Item', value: `\`${session.item}\``, inline: false },
                    { name: 'Catatan', value: `\`${session.notes || '-'}\``, inline: false },
                    { name: 'Rentang Nominal', value: `\`${session.selectedRange}\``, inline: true },
                    { name: 'Fee', value: `\`Rp${session.fee.toLocaleString('id-ID')}\``, inline: true },
                    { name: 'Total Pembayaran', value: `\`Rp${session.price.toLocaleString('id-ID')}\``, inline: true },
                    { name: '📌 Status', value: '🟡 Waiting Payment', inline: true },
                    { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                    { name: '💳 Pembayaran', value: `Silakan lakukan pembayaran fee sesuai dengan total yang tertera di atas.\n\n🟦 **GoPay**\n\`081393625527\``, inline: false },
                    { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                    { 
                        name: '📝 Catatan Pembayaran', 
                        value: 
                            '• Setelah pembayaran fee selesai, kirim bukti transfer langsung pada Ticket ini.\n' +
                            '• Mohon tunggu hingga Staff memverifikasi pembayaran Anda secara manual.\n' +
                            '• Setelah fee terkonfirmasi, grup MM akan dibuat atau dilanjutkan.',
                        inline: false 
                    }
                )
    
                .setTimestamp();
        } else if (isLimited) {
            ticketEmbed = new EmbedBuilder()
                .setTitle('📦 Pesanan LyraBlox')
                .setDescription(
                    `Halo <@${interaction.user.id}>,\n\n` +
                    `Terima kasih telah mempercayai LyraBlox.\n` +
                    `Pesanan berhasil dibuat.\n\n━━━━━━━━━━━━━━━━━━\n\n`
                )
                .setColor('#a855f7')
                .addFields(
                    { name: '📦 Produk', value: 'Limited Item', inline: true },
                    { name: '👤 Username Roblox', value: `\`${session.robloxUsername}\``, inline: true },
                    { name: '💎 Nama Item', value: `\`${session.item}\``, inline: true },
                    { name: '💰 Harga', value: `\`Rp ${session.price.toLocaleString('id-ID')}\``, inline: true },
                    { name: '📌 Status', value: '🟡 Pending Payment', inline: true },
                    { name: '📝 Catatan', value: `\`${session.notes || '-'}\``, inline: false },
                    { name: '━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                    { name: '💳 Pembayaran', value: `Silakan lakukan pembayaran sesuai nominal di atas.\n\n🟦 **GoPay**\n\`081393625527\``, inline: false },
                    { name: '━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                    { 
                        name: '📝 Catatan Pembayaran', 
                        value: 
                            '• Setelah pembayaran selesai, kirim bukti transfer langsung pada Ticket ini.\n' +
                            '• Mohon tunggu hingga Staff memverifikasi pembayaran Anda secara manual.',
                        inline: false 
                    }
                )
    
                .setTimestamp();
        } else if (isBoost) {
            ticketEmbed = new EmbedBuilder()
                .setTitle('🛒 Pesanan LyraBlox - Boost')
                .setDescription(
                    `Halo <@${interaction.user.id}>,\n\n` +
                    `Terima kasih telah memesan layanan Boost di LyraBlox.\n` +
                    `Pesanan berhasil dibuat.\n\n━━━━━━━━━━━━━━━━━━\n\n`
                )
                .setColor('#ff9900')
                .addFields(
                    { name: '📦 Produk', value: productName, inline: true },
                    { name: '🎁 Paket', value: `\`${session.packageLabel}\``, inline: true },
                    { name: '💰 Harga', value: `\`Rp ${session.price.toLocaleString('id-ID')}\``, inline: true },
                    { name: '👤 Username Roblox', value: `\`${session.robloxUsername}\``, inline: true },
                    { name: '📌 Status', value: '🟡 Pending Payment', inline: true },
                    ...(session.robloxPassword ? [{ name: '🔑 Password', value: `||${session.robloxPassword}||`, inline: true }] : []),
                    { name: '━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                    { name: '💳 Pembayaran', value: `Silakan lakukan pembayaran sesuai nominal di atas.\n\n🟦 **GoPay**\n\`081393625527\``, inline: false },
                    { name: '━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                    { 
                        name: '📝 Catatan Pembayaran', 
                        value: 
                            '• Setelah pembayaran selesai, kirim bukti transfer langsung pada Ticket ini.\n' +
                            '• Mohon tunggu hingga Staff memverifikasi pembayaran Anda secara manual.',
                        inline: false 
                    }
                )
    
                .setTimestamp();
        } else {
            ticketEmbed = new EmbedBuilder()
                .setTitle('🛒 Pesanan LyraBlox')
                .setDescription(
                    `Halo <@${interaction.user.id}>,\n\n` +
                    `Terima kasih telah mempercayai pembelian Robux kepada LyraBlox.\n` +
                    `Pesanan Anda berhasil dibuat.\n` +
                    `Silakan lakukan pembayaran sesuai instruksi di bawah ini.\n`
                )
                .addFields(
                    { name: '📦 Produk', value: productName, inline: true },
                    { name: '🎁 Paket', value: session.isCustom ? 'Custom' : `${session.amount.toLocaleString('id-ID')} Robux`, inline: true },
                    { name: '💎 Jumlah Robux', value: `${session.amount.toLocaleString('id-ID')} Robux`, inline: true },
                    { name: '💰 Total', value: `Rp ${session.price.toLocaleString('id-ID')}`, inline: true },
                    { name: '👤 Username', value: `\`${session.robloxUsername}\``, inline: true },
                    { name: '📌 Status', value: '🟡 Pending', inline: true },
                    ...(isVisend ? [] : [{ name: '🔑 Password', value: `||${session.robloxPassword}||`, inline: true }]),
                    { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                    { name: '💳 Pembayaran', value: `Silakan lakukan pembayaran sesuai dengan total yang tertera di atas.\n\n🟦 **GoPay**\n\`081393625527\``, inline: false },
                    { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                    { 
                        name: '📝 Catatan Pembayaran', 
                        value: 
                            '• Maksimal pembayaran melalui QRIS adalah Rp500.000 untuk setiap transaksi.\n' +
                            '• Untuk transaksi di atas Rp500.000, silakan lakukan pembayaran lebih dari satu kali, atau gunakan satu kali pembayaran dengan tambahan biaya QRIS sebesar 0,3%.\n' +
                            '• Apabila melakukan transfer ke GoPay menggunakan Bank atau E-Wallet selain GoPay, akan dikenakan biaya tambahan sebesar Rp1.000 sesuai ketentuan penyedia layanan.\n' +
                            '• Pastikan nominal pembayaran sesuai dengan total yang tertera pada Ticket.\n' +
                            '• Setelah pembayaran selesai, kirim bukti transfer langsung pada Ticket ini.\n' +
                            '• Mohon tunggu hingga Staff memverifikasi pembayaran Anda secara manual.',
                        inline: false 
                    }
                )
                .setColor('#ffaa00')
    
                .setTimestamp();
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`robux_deliver_${orderId}`).setLabel('Mark Delivered').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`copy_user_${orderId}`).setLabel('📋 Copy Username').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
        );
        
        if (isVisend) {
            row.addComponents(
                new ButtonBuilder().setCustomId('tutorial_v2l').setLabel('🔐 Tutorial V2L').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tutorial_cek_limit').setLabel('📊 Cek Limit Robux').setStyle(ButtonStyle.Secondary)
            );
        }

        const staffMention = staffRoleId ? `<@&${staffRoleId}>` : '';
        const adminMention = adminRoleId ? `<@&${adminRoleId}>` : '';
        await channel.send(`${interaction.user} | ${staffMention} ${adminMention}`);
        await channel.send({ 
            embeds: [ticketEmbed], 
            components: [row]
        });
        await channel.send({
            content: '📷 **QR Code Pembayaran:**',
            files: [qrAttachment]
        });

        await interaction.editReply({ content: `✅ Pesanan dikonfirmasi! Silakan lanjutkan pembayaran di tiket: ${channel}`, embeds: [], components: [] });
    } catch (err) {
        logger.error('[InteractionCreate] Error confirming order:', err);
        return interaction.editReply({ content: '❌ Terjadi kesalahan saat memproses pesanan.', embeds: [], components: [] });
    }
}
module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
        // Handle Slash Commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            const startTime = Date.now();
            try {
                await command.execute(interaction);
                const latency = Date.now() - startTime;
                const metricsService = require('../services/metricsService');
                metricsService.recordCommand(interaction.commandName, latency);
            } catch (error) {
                console.error('Command Execution Error:', error);
                const replyOpts = { content: 'Terdapat kesalahan saat mengeksekusi command ini!', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyOpts).catch(() => {});
                } else {
                    await interaction.reply(replyOpts).catch(() => {});
                }
            }
            return;
        }

            // Centralized Order Handler Logic
            // deferred = true means interaction.deferReply() was already called, use editReply
            const handleOrderClick = async (type, deferred = false) => {
                const setting = await getStoreSetting();
                
                // Product-specific status check
                if (setting.products) {
                    let productEnabled = true;
                    
                    if (type === 'vilog') {
                        productEnabled = setting.products.robux_login.enabled;
                    } else if (type === 'visend') {
                        productEnabled = setting.products.robux_send.enabled;
                    } else if (type === 'gig' || type === 'boost') { // boost is tied to gig status
                        productEnabled = setting.products.gift_in_game.enabled;
                    }
                    
                    if (!productEnabled) {
                        const closedEmbed = new EmbedBuilder()
                            .setTitle('🔴 Layanan Sedang Ditutup')
                            .setDescription('Mohon maaf.\nLayanan ini sedang tidak menerima pesanan.\nSilakan coba kembali nanti.')
                            .setColor('#ff0000');
                        
                        if (deferred) {
                            await interaction.editReply({ embeds: [closedEmbed] });
                        } else {
                            await interaction.reply({ embeds: [closedEmbed], ephemeral: true });
                        }
                        return 'closed';
                    }
                }
                
                return 'proceed'; // Let the code proceed
            };

        // Handle String Select Menus
        if (interaction.isStringSelectMenu()) {
            if (interaction.replied || interaction.deferred) return;
            const { customId } = interaction;

            if (customId === 'select_mm_fee') {
                const mmRekberService = require('../services/mmRekberService');
                return await mmRekberService.handleFeeSelection(interaction);
            }

            if (customId === 'mm_fee_select_action') {
                const action = interaction.values[0];
                let fee = null;

                if (action !== 'create_new') {
                    const configService = require('../services/configService');
                    const fees = await configService.getMMFees();
                    fee = fees.find(f => f._id.toString() === action);
                }

                const modal = new ModalBuilder()
                    .setCustomId(action === 'create_new' ? 'modal_mm_fee_create' : `modal_mm_fee_edit_${action}`)
                    .setTitle(action === 'create_new' ? 'Tambah Fee MM' : 'Edit Fee MM');

                const minInput = new TextInputBuilder()
                    .setCustomId('minAmount')
                    .setLabel('Minimal Transaksi (Rp)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(fee ? fee.minAmount.toString() : '0')
                    .setRequired(true);

                const maxInput = new TextInputBuilder()
                    .setCustomId('maxAmount')
                    .setLabel('Maksimal Transaksi (Rp)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(fee ? fee.maxAmount.toString() : '999999999')
                    .setRequired(true);

                const feeInput = new TextInputBuilder()
                    .setCustomId('feeAmount')
                    .setLabel('Biaya Fee (Rp)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(fee ? fee.fee.toString() : '5000')
                    .setRequired(true);
                
                const displayOrderInput = new TextInputBuilder()
                    .setCustomId('displayOrder')
                    .setLabel('Urutan Display')
                    .setStyle(TextInputStyle.Short)
                    .setValue(fee ? (fee.displayOrder || 0).toString() : '0')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(minInput),
                    new ActionRowBuilder().addComponents(maxInput),
                    new ActionRowBuilder().addComponents(feeInput),
                    new ActionRowBuilder().addComponents(displayOrderInput)
                );

                return await interaction.showModal(modal);
            }

            if (customId.startsWith('verify_answer_')) {
                const questionIndex = parseInt(customId.split('_')[2]);
                const selectedAnswer = interaction.values[0];

                const Verification = require('../models/Verification');
                const doc = await Verification.findOne({ discordId: interaction.user.id });

                if (!doc || doc.status !== 'active' || !doc.activeSession) {
                    return interaction.reply({ content: '❌ Sesi verifikasi tidak ditemukan atau sudah kedaluwarsa. Silakan mulai ulang.', ephemeral: true });
                }

                if (doc.activeSession.questions[questionIndex]) {
                    doc.activeSession.questions[questionIndex].selectedAnswer = selectedAnswer;
                    doc.activeSession.currentIndex += 1;
                    doc.markModified('activeSession');
                    await doc.save();
                }

                const verificationService = require('../services/verificationService');
                return verificationService.renderWizardStep(interaction, doc, false);
            }


            if (customId === 'vilog_select_package') {
                const selectedValue = interaction.values[0];
                const [amount, price] = selectedValue.split(':');

                const modal = new ModalBuilder()
                    .setCustomId(`vilog_modal_order:${amount}:${price}`)
                    .setTitle(`Order ${amount} Robux Vilog`);

                const usernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Username Roblox')
                    .setPlaceholder('Masukkan username Roblox Anda')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const passwordInput = new TextInputBuilder()
                    .setCustomId('roblox_password')
                    .setLabel('Password Roblox')
                    .setPlaceholder('Masukkan password Roblox Anda')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(usernameInput),
                    new ActionRowBuilder().addComponents(passwordInput)
                );

                return await interaction.showModal(modal);
            }

            if (customId === 'boost_fishit_select_package' || customId === 'boost_kalb_select_package') {
                const check = await handleOrderClick('boost');
                if (check !== 'proceed') return;
                
                const selectedValue = interaction.values[0];
                const [packageLabel, price] = selectedValue.split(':');
                const isFishit = customId === 'boost_fishit_select_package';

                const modal = new ModalBuilder()
                    .setCustomId(`boost_modal_order:${isFishit ? 'fishit' : 'kalb'}:${packageLabel}:${price}`)
                    .setTitle(`Order Boost ${isFishit ? 'Fishit' : 'Kalb'}`);

                const usernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Username Roblox')
                    .setPlaceholder('Masukkan username Roblox Anda')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const passwordInput = new TextInputBuilder()
                    .setCustomId('roblox_password')
                    .setLabel('Password Roblox (Opsional)')
                    .setPlaceholder('Masukkan password jika perlu')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(usernameInput),
                    new ActionRowBuilder().addComponents(passwordInput)
                );

                try {
                    return await interaction.showModal(modal);
                } catch(e) {
                    return; // Ignore race condition / already acknowledged
                }
            }

            if (customId === 'visend_select_package') {
                const selectedValue = interaction.values[0];

                if (selectedValue === 'divider:0' || selectedValue === 'custom:0') {
                    return interaction.reply({ content: '❌ Pilihan tidak valid.', ephemeral: true });
                }

                const [amount, price] = selectedValue.split(':');

                const modal = new ModalBuilder()
                    .setCustomId(`visend_modal_order:${amount}:${price}`)
                    .setTitle(`Order ${amount} Robux Visend`);

                const usernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Username Roblox (Tujuan)')
                    .setPlaceholder('Masukkan username Roblox tujuan Gift')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(usernameInput)
                );

                return await interaction.showModal(modal);
            }
        }

        if (interaction.isButton()) {
            const { customId } = interaction;

            if (customId === 'verify') {
                const verificationService = require('../services/verificationService');
                return await verificationService.handleVerifyButton(interaction);
            }

            if (customId.startsWith('leaderboard_')) {
                if (interaction.replied || interaction.deferred) return;
                try {
                    await interaction.deferUpdate();
                } catch (e) {
                    if (e.code === 40060) return; // Ignore already acknowledged
                    console.error(e);
                }
                const timeframe = customId.replace('leaderboard_', '');
                try {
                    const { generateLeaderboardEmbed } = require('../services/leaderboardHelper');
                    const result = await generateLeaderboardEmbed(interaction.user, timeframe);
                    await interaction.editReply({ embeds: [result.embed], components: [result.row] });
                } catch (error) {
                    console.error('Error generating leaderboard from button:', error);
                    await interaction.followUp({ content: '❌ Terjadi kesalahan saat memuat leaderboard.', ephemeral: true });
                }
                return;
            }



            // Dashboard Management Menus
            if (customId === 'dashboard_menu_inventory') {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (interaction.guild.ownerId !== interaction.user.id && !member.permissions.has('Administrator')) {
                    return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
                }

                const configService = require('../services/configService');
                const config = await configService.getGlobalConfig();

                const modal = new ModalBuilder()
                    .setCustomId('modal_inventory_management')
                    .setTitle('Inventory Management');

                const gigInput = new TextInputBuilder()
                    .setCustomId('input_gig_stock')
                    .setLabel('Stock Gift In Game (GIG)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(config.gigStock ? config.gigStock.toString() : '0')
                    .setRequired(true);

                const sendInput = new TextInputBuilder()
                    .setCustomId('input_send_stock')
                    .setLabel('Stock Robux Via Send')
                    .setStyle(TextInputStyle.Short)
                    .setValue(config.sendStock ? config.sendStock.toString() : '0')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(gigInput),
                    new ActionRowBuilder().addComponents(sendInput)
                );

                return await interaction.showModal(modal);
            }

            if (customId === 'dashboard_menu_product') {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (interaction.guild.ownerId !== interaction.user.id && !member.permissions.has('Administrator')) {
                    return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
                }

                const select = new StringSelectMenuBuilder()
                    .setCustomId('dashboard_select_product_type')
                    .setPlaceholder('Pilih Product untuk dikelola...')
                    .addOptions(
                        { label: 'Robux Via Login', value: 'LOGIN', emoji: '🟢' },
                        { label: 'Robux Via Send', value: 'SEND', emoji: '📦' },
                        { label: 'Gamepass (Pending 5 Hari)', value: 'COPAY', emoji: '🌐' }
                    );

                const row = new ActionRowBuilder().addComponents(select);
                return interaction.reply({ content: 'Silakan pilih Product yang ingin Anda ubah Pricelist-nya:', components: [row], ephemeral: true });
            }

            if (customId === 'dashboard_menu_gig') {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (interaction.guild.ownerId !== interaction.user.id && !member.permissions.has('Administrator')) {
                    return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
                }

                const configService = require('../services/configService');
                const config = await configService.getGlobalConfig();

                const modal = new ModalBuilder()
                    .setCustomId('modal_gig_config')
                    .setTitle('GIG Config (Gift In Game)');

                const rateInput = new TextInputBuilder()
                    .setCustomId('input_gig_rate')
                    .setLabel('GIG Rate (contoh: 90, 95)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(config.gigRate ? config.gigRate.toString() : '90')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(rateInput));

                return await interaction.showModal(modal);
            }

            if (customId === 'dashboard_limited_menu') {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (interaction.guild.ownerId !== interaction.user.id && !member.permissions.has('Administrator')) {
                    return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
                }

                const configService = require('../services/configService');
                const config = await configService.getGlobalConfig();
                const limitedStatus = config.products?.limited_item?.status || 'OPEN';

                const embed = new EmbedBuilder()
                    .setTitle('💎 Limited Management')
                    .setDescription('Silakan kelola konfigurasi Limited Item di bawah ini.\n\n`Status:` ' + (limitedStatus === 'OPEN' ? '🟢 OPEN' : '🔴 CLOSE'))
                    .setColor('#0099ff');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('limited_toggle_status').setLabel(`Toggle Status (Sekarang ${limitedStatus})`).setStyle(limitedStatus === 'OPEN' ? ButtonStyle.Success : ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('limited_sync_panel').setLabel('🔄 Deploy / Sync Panel').setStyle(ButtonStyle.Secondary)
                );

                return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }

            if (customId === 'limited_sync_panel') {
                await interaction.deferReply({ ephemeral: true });
                const limitedItemService = require('../services/limitedItemService');
                await limitedItemService.syncLimitedPanel(interaction.client);
                return interaction.editReply('✅ Panel Limited Item berhasil di-deploy / sync ke channel Limited.');
            }

            if (customId === 'limited_toggle_status') {
                await interaction.deferUpdate();
                const configService = require('../services/configService');
                const config = await configService.getGlobalConfig();
                const newStatus = config.products?.limited_item?.status === 'OPEN' ? 'CLOSE' : 'OPEN';
                await configService.toggleLimitedStatus(newStatus, interaction.user.username, interaction.user.id);
                
                const { buildDashboardMessage } = require('../services/storeService');
                await buildDashboardMessage(interaction.client);
                const voiceStatusService = require('../services/voiceStatusService');
                voiceStatusService.updateAllVoiceStatuses(interaction.client);
                
                return interaction.editReply({ content: `✅ Status Limited Item berhasil diubah menjadi ${newStatus}.`, embeds: [], components: [] });
            }

            if (customId === 'dashboard_menu_mm') {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (interaction.guild.ownerId !== interaction.user.id && !member.permissions.has('Administrator')) {
                    return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
                }

                const configService = require('../services/configService');
                const config = await configService.getGlobalConfig();
                const mmStatus = config.products?.mm_rekber?.status || 'OPEN';

                const embed = new EmbedBuilder()
                    .setTitle('🛡️ MM Management')
                    .setDescription('Silakan kelola konfigurasi MM / Rekber di bawah ini.\n\n`Status:` ' + (mmStatus === 'OPEN' ? '🟢 OPEN' : '🔴 CLOSE'))
                    .setColor('#0099ff');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('mm_manage_fee').setLabel('📝 Kelola Daftar Fee').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('mm_toggle_status').setLabel(`Toggle Status (Sekarang ${mmStatus})`).setStyle(mmStatus === 'OPEN' ? ButtonStyle.Success : ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('mm_sync_panel').setLabel('🔄 Deploy / Sync Panel').setStyle(ButtonStyle.Secondary)
                );

                return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }

            if (customId === 'mm_sync_panel') {
                await interaction.deferReply({ ephemeral: true });
                const mmRekberService = require('../services/mmRekberService');
                await mmRekberService.syncMMPanel(interaction.client);
                return interaction.editReply('✅ Panel MM berhasil di-deploy / sync ke channel MM.');
            }

            if (customId === 'mm_toggle_status') {
                await interaction.deferUpdate();
                const configService = require('../services/configService');
                const config = await configService.getGlobalConfig();
                const newStatus = config.products?.mm_rekber?.status === 'OPEN' ? 'CLOSE' : 'OPEN';
                await configService.toggleMMStatus(newStatus, interaction.user.username, interaction.user.id);
                
                // Refresh dashboard message
                const { buildDashboardMessage } = require('../services/storeService');
                const newDashboard = await buildDashboardMessage(interaction.client);
                const voiceStatusService = require('../services/voiceStatusService');
                voiceStatusService.updateAllVoiceStatuses(interaction.client);
                
                return interaction.editReply({ content: `✅ Status MM berhasil diubah menjadi ${newStatus}.`, embeds: [], components: [] });
            }

            if (customId === 'mm_manage_fee') {
                // Return a select menu to either create new fee or edit existing
                const configService = require('../services/configService');
                const fees = await configService.getMMFees();

                const select = new StringSelectMenuBuilder()
                    .setCustomId('mm_fee_select_action')
                    .setPlaceholder('Pilih aksi...')
                    .addOptions(
                        { label: '➕ Tambah Fee Baru', value: 'create_new', description: 'Buat rentang fee baru', emoji: '➕' }
                    );

                fees.forEach(f => {
                    const minStr = `Rp${f.minAmount.toLocaleString('id-ID')}`;
                    const maxStr = f.maxAmount >= 999999999 ? 'Ke Atas' : `Rp${f.maxAmount.toLocaleString('id-ID')}`;
                    select.addOptions({
                        label: `Edit: ${minStr} - ${maxStr}`,
                        description: `Fee: Rp${f.fee.toLocaleString('id-ID')}`,
                        value: f._id.toString()
                    });
                });

                const row = new ActionRowBuilder().addComponents(select);
                return interaction.reply({ content: 'Pilih Fee yang ingin diedit, atau buat baru:', components: [row], ephemeral: true });
            }

            // Toggle Product Status Buttons
            if (customId === 'toggle_robux_login' || customId === 'toggle_robux_send' || customId === 'toggle_gift_in_game' || customId === 'toggle_copay') {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                const isOwner = interaction.guild.ownerId === interaction.user.id;
                const isAdmin = member.permissions.has('Administrator');
                
                if (!isOwner && !isAdmin) {
                    return interaction.reply({ content: '❌ Anda tidak memiliki izin untuk mengelola Dashboard.', ephemeral: true });
                }

                await interaction.deferUpdate();
                
                const setting = await getStoreSetting();
                if (!setting.products) {
                    setting.products = {
                        robux_login: { enabled: true },
                        robux_send: { enabled: true },
                        gift_in_game: { enabled: true },
                        copay: { enabled: true }
                    };
                }

                if (customId === 'toggle_robux_login') {
                    setting.products.robux_login.enabled = !setting.products.robux_login.enabled;
                } else if (customId === 'toggle_robux_send') {
                    setting.products.robux_send.enabled = !setting.products.robux_send.enabled;
                } else if (customId === 'toggle_gift_in_game') {
                    setting.products.gift_in_game.enabled = !setting.products.gift_in_game.enabled;
                } else if (customId === 'toggle_copay') {
                    if (!setting.products.copay) setting.products.copay = { enabled: true };
                    setting.products.copay.enabled = !setting.products.copay.enabled;
                }

                setting.updatedBy = interaction.user.username;
                setting.markModified('products');
                await setting.save();

                // Update Voice Status
                const voiceStatusService = require('../services/voiceStatusService');
                voiceStatusService.updateAllVoiceStatuses(interaction.client);

                const newDashboard = await buildDashboardMessage(interaction.client);
                await interaction.editReply({ embeds: newDashboard.embeds, components: newDashboard.components });
                return;
            }

            // Refresh Server Handler
            if (customId === 'dashboard_refresh_server') {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                const isOwner = interaction.guild.ownerId === interaction.user.id;
                const isAdmin = member.permissions.has('Administrator');
                
                if (!isOwner && !isAdmin) {
                    return interaction.reply({ content: '❌ Anda tidak memiliki permission untuk melakukan refresh server.', ephemeral: true });
                }

                await interaction.reply({ content: '⏳ Refreshing Server...', ephemeral: true });

                try {
                    const configService = require('../services/configService');
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
                        const guildId = process.env.GUILD_ID || interaction.guild.id;
                        await configService.getGlobalConfig(guildId, true);
                    }

                    // Sync Voice Status
                    const voiceStatusService = require('../services/voiceStatusService');
                    if (voiceStatusService.updateAllVoiceStatuses && interaction.client) {
                        voiceStatusService.updateAllVoiceStatuses(interaction.client);
                    }
                    
                    // Sync Panels
                    const robuxService = require('../services/robuxService');
                    if (robuxService.syncVisendPanel) await robuxService.syncVisendPanel(interaction.client);
                    if (robuxService.syncVilogPanel) await robuxService.syncVilogPanel(interaction.client);
                    
                    // Sync Dashboard itself
                    const dashboardService = require('../services/dashboardService');
                    await dashboardService.syncDashboard(interaction.client);
                    
                    await interaction.editReply({
                        content: `🔄 **Server Refresh**\n\n✅ Configuration synced\n✅ Product Panels synced\n✅ Voice Status synced\n✅ Store Status synced\n\nRefresh completed successfully. Bot tetap online tanpa perlu restart.`
                    });
                } catch (err) {
                    const logger = require('../utils/logger');
                    logger.error('[Dashboard] Error during server refresh:', err);
                    await interaction.editReply({ content: '❌ Refresh Server gagal. Hubungi Developer.' });
                }
                return;
            }

            // Cancel Busy Warn
            if (customId === 'cancel_order_warn') {
                return interaction.update({ content: '❌ Pesanan dibatalkan.', embeds: [], components: [] });
            }


            // Static Verification Button
            if (customId === 'verify_btn') {
                const modal = new ModalBuilder()
                    .setCustomId('verify_modal')
                    .setTitle('Verifikasi Akun Roblox');

                const usernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Masukkan Username Roblox Anda')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMinLength(3)
                    .setMaxLength(20);

                modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
                return await interaction.showModal(modal);
            }

            // Order Robux Via Login Button Trigger
            
            // ==========================================
            // VERIFICATION SYSTEM HANDLERS
            // ==========================================
            if (customId === 'verify_start') {
                const verificationService = require('../services/verificationService');
                return verificationService.startVerification(interaction);
            }
            // ==========================================

            // ==========================================
            // COPAY BUTTON HANDLERS
            // ==========================================

            // Button: 🌐 Join Community (sends DM with community links)
            if (customId === 'copay_join_community') {
                const existing = await CopayEligibility.findOne({ discordId: interaction.user.id });
                if (existing) {
                    const unixEligible = Math.floor(existing.eligibleAt.getTime() / 1000);
                    if (existing.status === 'eligible') {
                        return interaction.reply({ content: '✅ Anda sudah **Eligible**! Silakan langsung tekan tombol **🛒 Order Payout**.', ephemeral: true });
                    }
                    return interaction.reply({ content: `⏳ Timer Eligibility Anda sudah berjalan.\n🎯 Eligible pada: <t:${unixEligible}:F> (<t:${unixEligible}:R>)`, ephemeral: true });
                }

                const dmEmbed = new EmbedBuilder()
                    .setTitle('🌐 JOIN COMMUNITY ROBLOX')
                    .setDescription(
                        'Silakan bergabung ke **SELURUH** komunitas Roblox LyraBlox berikut:\n\n' +
                        '1️⃣ https://www.roblox.com/share/g/628192083\n' +
                        '2️⃣ https://www.roblox.com/share/g/354576018\n' +
                        '3️⃣ https://www.roblox.com/share/g/196386723\n' +
                        '4️⃣ https://www.roblox.com/share/g/1061172752\n\n' +
                        '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                        'Setelah Anda bergabung ke **seluruh** Community di atas, tekan tombol di bawah ini untuk mengkonfirmasi.'
                    )
                    .setColor('#3498db');
                
                const dmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('copay_confirm_joined')
                        .setLabel('✅ Saya Sudah Join')
                        .setStyle(ButtonStyle.Success)
                );
                
                try {
                    await interaction.user.send({ embeds: [dmEmbed], components: [dmRow] });
                    return interaction.reply({ content: '✅ Silakan cek **DM** Anda untuk melanjutkan proses Join Community.', ephemeral: true });
                } catch (err) {
                    return interaction.reply({ content: '❌ Gagal mengirim DM. Pastikan setting DM Anda terbuka untuk server ini.', ephemeral: true });
                }
            }

            // Button: ✅ Saya Sudah Join (in DM — opens modal for Roblox username)
            if (customId === 'copay_confirm_joined') {
                const existing = await CopayEligibility.findOne({ discordId: interaction.user.id });
                if (existing) {
                    const unixEligible = Math.floor(existing.eligibleAt.getTime() / 1000);
                    return interaction.reply({ content: `❌ Timer Eligibility Anda sudah berjalan.\n🎯 Eligible pada: <t:${unixEligible}:F> (<t:${unixEligible}:R>)`, ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId('copay_username_modal')
                    .setTitle('Konfirmasi Username Roblox');
                
                const usernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Username Roblox')
                    .setPlaceholder('Masukkan Username Roblox Anda...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
                return interaction.showModal(modal);
            }

            // Button: 📊 Cek Status Eligibility
            if (customId === 'copay_check_status') {
                const doc = await CopayEligibility.findOne({ discordId: interaction.user.id });
                if (!doc) {
                    return interaction.reply({ content: '❌ Anda belum memulai Eligibility. Silakan tekan tombol **🌐 Join Community** terlebih dahulu.', ephemeral: true });
                }

                const unixStart = Math.floor(doc.startedAt.getTime() / 1000);
                const unixEligible = Math.floor(doc.eligibleAt.getTime() / 1000);
                const now = new Date();
                const elapsed = Math.max(0, Math.floor((now - doc.startedAt) / (1000 * 60 * 60 * 24)));
                const progressDays = Math.min(elapsed, 14);

                let statusEmoji, statusText;
                if (doc.status === 'eligible') {
                    statusEmoji = '🟢';
                    statusText = 'Eligible';
                } else {
                    statusEmoji = '🟡';
                    statusText = 'Waiting';
                }

                const statusEmbed = new EmbedBuilder()
                    .setTitle('⏳ ROBUX COMMUNITY ELIGIBILITY')
                    .setDescription(
                        `👤 **Roblox Username**\n${doc.robloxUsername}\n\n` +
                        `📅 **Mulai Perhitungan**\n<t:${unixStart}:F> (<t:${unixStart}:R>)\n\n` +
                        `🎯 **Eligible Pada**\n<t:${unixEligible}:F> (<t:${unixEligible}:R>)\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `**Progress**\n` +
                        `Status: ${statusEmoji} ${statusText}\n` +
                        `Progress: ${progressDays} / 14 Hari`
                    )
                    .setColor(doc.status === 'eligible' ? '#2ecc71' : '#f1c40f')
                    .setFooter({ text: doc.status === 'eligible' ? 'Anda sudah dapat melakukan order!' : 'Bot akan memberi tahu Anda secara otomatis ketika telah memenuhi syarat.' });

                try {
                    await interaction.user.send({ embeds: [statusEmbed] });
                    return interaction.reply({ content: '✅ Status Eligibility telah dikirim ke **DM** Anda.', ephemeral: true });
                } catch (err) {
                    return interaction.reply({ embeds: [statusEmbed], ephemeral: true });
                }
            }

            // Button: 🛒 Order Payout (checks eligible role)
            if (customId === 'copay_order_now') {
                const setting = await getStoreSetting();
                if (setting.products && setting.products.copay && !setting.products.copay.enabled) {
                    return interaction.reply({ content: '❌ Fitur Payout sedang ditutup sementara karena rawan terbanned. Silakan coba lagi nanti.', ephemeral: true });
                }

                const ELIGIBLE_ROLE_ID = '1534989509857509426';
                const member = interaction.member;
                const hasRole = member && member.roles && member.roles.cache.has(ELIGIBLE_ROLE_ID);

                if (!hasRole) {
                    const embed = new EmbedBuilder()
                        .setDescription(
                            '━━━━━━━━━━━━━━━━━━\n\n' +
                            '❌ **Anda belum memenuhi syarat.**\n\n' +
                            'Silakan bergabung ke seluruh Community Roblox dan tunggu minimal 14 Hari.\n\n' +
                            '━━━━━━━━━━━━━━━━━━'
                        )
                        .setColor('#e74c3c');
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                const configService = require('../services/configService');
                const packages = await configService.getProductPackages('copay');
                if (packages.length === 0) {
                    return interaction.reply({ content: '❌ Paket Robux (Copay) saat ini sedang kosong.', ephemeral: true });
                }

                const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('copay_select_package')
                    .setPlaceholder('Pilih paket yang ingin dibeli...');

                packages.forEach(pkg => {
                    selectMenu.addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`${pkg.amount} Robux`)
                            .setDescription(`Harga: Rp ${pkg.price.toLocaleString('id-ID')}`)
                            .setValue(pkg._id.toString())
                    );
                });

                const row = new ActionRowBuilder().addComponents(selectMenu);
                return interaction.reply({ content: 'Silakan pilih paket Gamepass (Pending 5 Hari) yang ingin Anda beli:', components: [row], ephemeral: true });
            }

            // Select Menu: copay_select_package
            if (customId === 'copay_select_package') {
                const packageId = interaction.values[0];
                const pkg = await RobuxPackage.findById(packageId);
                if (!pkg) return interaction.reply({ content: 'Paket tidak ditemukan.', ephemeral: true });

                const modal = new ModalBuilder()
                    .setCustomId(`copay_modal_order:${packageId}`)
                    .setTitle('Konfirmasi Pesanan Gamepass (Pending 5 Hari)');
                
                const robloxUsernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Username Roblox Tujuan')
                    .setPlaceholder('Masukkan Username Roblox...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(robloxUsernameInput));
                return await interaction.showModal(modal);
            }
            // ==========================================

            if (customId === 'vilog_order_now') {
                await interaction.deferReply({ ephemeral: true });
                const check = await handleOrderClick('vilog', true);
                if (check !== 'proceed') return;
                try {
                    const configService = require('../services/configService');
                    const packages = await configService.getProductPackages('vilog');
                    if (packages.length === 0) {
                        return interaction.editReply({ content: '❌ Saat ini belum ada paket Robux Vilog yang aktif di database.' });
                    }

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('vilog_select_package')
                        .setPlaceholder('Pilih Paket Robux');

                    packages.forEach(pkg => {
                        select.addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(`${pkg.amount.toLocaleString('id-ID')} Robux`)
                                .setDescription(`Harga: Rp ${pkg.price.toLocaleString('id-ID')}`)
                                .setValue(`${pkg.amount}:${pkg.price}`)
                        );
                    });

                    const row = new ActionRowBuilder().addComponents(select);
                    return await interaction.editReply({ content: 'Silakan pilih paket Robux yang ingin Anda beli:', components: [row] });
                } catch (err) {
                    logger.error('[InteractionCreate] Error loading Vilog packages:', err);
                    return interaction.editReply({ content: '❌ Gagal memuat daftar paket Robux.' }).catch(() => {});
                }
            }

            // Order Robux Via Send Button Trigger
            if (customId === 'visend_order_now') {
                try {
                    await interaction.deferReply({ ephemeral: true });
                } catch(e) {
                    return;
                }
                const check = await handleOrderClick('visend', true);
                if (check !== 'proceed') return;
                try {
                    const configService = require('../services/configService');
                    const packages = await configService.getProductPackages('visend');
                    if (packages.length === 0) {
                        return interaction.editReply({ content: '❌ Saat ini belum ada paket Robux Visend yang aktif di database.' });
                    }

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('visend_select_package')
                        .setPlaceholder('Pilih Paket Robux');

                    const seenValues = new Set();
                    packages
                        .slice()
                        .sort((a, b) => Number(a.amount) - Number(b.amount))
                        .forEach(pkg => {
                            const label = pkg.label || `${pkg.amount.toLocaleString('id-ID')} Robux`;
                            const value = `${pkg.amount}:${pkg.price}`;
                            if (seenValues.has(value)) return;
                            seenValues.add(value);
                            select.addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(label)
                                    .setDescription(`Harga: Rp ${pkg.price.toLocaleString('id-ID')}`)
                                    .setValue(value)
                            );
                        });

                    const row = new ActionRowBuilder().addComponents(select);
                    return await interaction.editReply({ content: 'Silakan pilih paket Robux yang ingin Anda beli:', components: [row] });
                } catch (err) {
                    logger.error('[InteractionCreate] Error loading Visend packages:', err);
                    return interaction.editReply({ content: '❌ Gagal memuat daftar paket Robux.' }).catch(() => {});
                }
            }

            // Order Gift In Game (GIG) Button Trigger
            if (customId === 'gig_order_now') {
                const check = await handleOrderClick('gig');
                if (check !== 'proceed') return;
                const modal = new ModalBuilder()
                    .setCustomId('gig_modal_order')
                    .setTitle('Order Gift In Game');

                const gameLinkInput = new TextInputBuilder()
                    .setCustomId('gig_game_link')
                    .setLabel('Nama / Link Map Roblox')
                    .setPlaceholder('Contoh: Pet Simulator 99 atau https://...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const gamepassNameInput = new TextInputBuilder()
                    .setCustomId('gig_gamepass_name')
                    .setLabel('Nama Gamepass')
                    .setPlaceholder('Contoh: VIP Gamepass')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const amountInput = new TextInputBuilder()
                    .setCustomId('gig_robux_amount')
                    .setLabel('Jumlah Robux Gamepass')
                    .setPlaceholder('Contoh: 500')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const usernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Username Roblox (Tujuan)')
                    .setPlaceholder('Masukkan username Roblox tujuan Gift')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(gameLinkInput),
                    new ActionRowBuilder().addComponents(gamepassNameInput),
                    new ActionRowBuilder().addComponents(amountInput),
                    new ActionRowBuilder().addComponents(usernameInput)
                );

                try {
                    return await interaction.showModal(modal);
                } catch (e) {
                    if (e.code === 10062 || e.code === 40060) return;
                    console.error('Error showing GIG modal:', e);
                }
            }

            if (customId === 'btn_mm_order') {
                const mmRekberService = require('../services/mmRekberService');
                const replyData = await mmRekberService.generateFeeSelectMenu();
                return await interaction.reply(replyData);
            }

            if (customId === 'btn_limited_order') {
                const configService = require('../services/configService');
                const config = await configService.getGlobalConfig();
                const limitedStatus = config.products?.limited_item?.status || 'OPEN';

                if (limitedStatus === 'CLOSE') {
                    const closeEmbed = new EmbedBuilder()
                        .setColor('#ef4444')
                        .setDescription('🔴 **Store Sedang Tutup**\n\nMohon maaf.\nProduk Limited Item sedang tidak menerima pesanan.\n\nSilakan kembali lagi ketika produk telah dibuka.');
                    return await interaction.reply({ embeds: [closeEmbed], ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId('modal_limited_order')
                    .setTitle('Form Limited Item');

                const usernameInput = new TextInputBuilder()
                    .setCustomId('limited_username')
                    .setLabel('Username Roblox')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const itemInput = new TextInputBuilder()
                    .setCustomId('limited_item_name')
                    .setLabel('Nama Limited Item')
                    .setPlaceholder('Contoh: Dominus, Valkyrie')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const priceInput = new TextInputBuilder()
                    .setCustomId('limited_price')
                    .setLabel('Harga (Rp)')
                    .setPlaceholder('Contoh: 35000000')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const notesInput = new TextInputBuilder()
                    .setCustomId('limited_notes')
                    .setLabel('Catatan Tambahan')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(usernameInput),
                    new ActionRowBuilder().addComponents(itemInput),
                    new ActionRowBuilder().addComponents(priceInput),
                    new ActionRowBuilder().addComponents(notesInput)
                );

                return await interaction.showModal(modal);
            }

            if (customId === 'continue_order_vilog') {
                await interaction.deferUpdate();
                const setting = await getStoreSetting();
                if (setting.products && !setting.products.robux_login.enabled) {
                    return interaction.editReply({ content: '❌ Mohon maaf, layanan ini sedang tidak menerima pesanan.', embeds: [], components: [] });
                }
                try {
                    const configService = require('../services/configService');
                    const packages = await configService.getProductPackages('vilog');
                    if (packages.length === 0) {
                        return interaction.editReply({ content: '❌ Saat ini belum ada paket Robux Vilog yang aktif di database.', embeds: [], components: [] });
                    }

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('vilog_select_package')
                        .setPlaceholder('Pilih Paket Robux');

                    packages.forEach(pkg => {
                        select.addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(`${pkg.amount.toLocaleString('id-ID')} Robux`)
                                .setDescription(`Harga: Rp ${pkg.price.toLocaleString('id-ID')}`)
                                .setValue(`${pkg.amount}:${pkg.price}`)
                        );
                    });

                    const row = new ActionRowBuilder().addComponents(select);
                    return await interaction.editReply({ content: 'Silakan pilih paket Robux yang ingin Anda beli:', components: [row] });
                } catch (err) {
                    logger.error('[InteractionCreate] Error loading Vilog packages:', err);
                    return interaction.editReply({ content: '❌ Gagal memuat daftar paket Robux.', embeds: [], components: [] }).catch(() => {});
                }
            }
            if (customId === 'continue_order_visend') {
                await interaction.deferUpdate();
                const setting = await getStoreSetting();
                if (setting.products && !setting.products.robux_send.enabled) {
                    return interaction.editReply({ content: '❌ Mohon maaf, layanan ini sedang tidak menerima pesanan.', embeds: [], components: [] });
                }
                try {
                    const configService = require('../services/configService');
                    const packages = await configService.getProductPackages('visend');
                    if (packages.length === 0) {
                        return interaction.editReply({ content: '❌ Saat ini belum ada paket Robux Visend yang aktif di database.', embeds: [], components: [] });
                    }

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('visend_select_package')
                        .setPlaceholder('Pilih Paket Robux');

                    const seenValues = new Set();
                    packages
                        .slice()
                        .sort((a, b) => Number(a.amount) - Number(b.amount))
                        .forEach(pkg => {
                            const label = pkg.label || `${pkg.amount.toLocaleString('id-ID')} Robux`;
                            const value = `${pkg.amount}:${pkg.price}`;
                            if (seenValues.has(value)) return;
                            seenValues.add(value);
                            select.addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(label)
                                    .setDescription(`Harga: Rp ${pkg.price.toLocaleString('id-ID')}`)
                                    .setValue(value)
                            );
                        });

                    const row = new ActionRowBuilder().addComponents(select);
                    return await interaction.editReply({ content: 'Silakan pilih paket Robux yang ingin Anda beli:', components: [row] });
                } catch (err) {
                    logger.error('[InteractionCreate] Error loading Visend packages:', err);
                    return interaction.editReply({ content: '❌ Gagal memuat daftar paket Robux.', embeds: [], components: [] }).catch(() => {});
                }
            }
            if (customId === 'continue_order_gig') {
                const setting = await getStoreSetting();
                if (setting.products && !setting.products.gift_in_game.enabled) {
                    return interaction.reply({ content: '❌ Mohon maaf, layanan ini sedang tidak menerima pesanan.', ephemeral: true }).catch(() => {});
                }
                const modal = new ModalBuilder()
                    .setCustomId('gig_modal_order')
                    .setTitle('Order Gift In Game');

                const gameLinkInput = new TextInputBuilder()
                    .setCustomId('gig_game_link')
                    .setLabel('Nama / Link Map Roblox')
                    .setPlaceholder('Contoh: Pet Simulator 99 atau https://...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const gamepassNameInput = new TextInputBuilder()
                    .setCustomId('gig_gamepass_name')
                    .setLabel('Nama Gamepass')
                    .setPlaceholder('Contoh: VIP Gamepass')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const amountInput = new TextInputBuilder()
                    .setCustomId('gig_robux_amount')
                    .setLabel('Jumlah Robux Gamepass')
                    .setPlaceholder('Contoh: 500')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const usernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Username Roblox (Tujuan)')
                    .setPlaceholder('Masukkan username Roblox tujuan Gift')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(gameLinkInput),
                    new ActionRowBuilder().addComponents(gamepassNameInput),
                    new ActionRowBuilder().addComponents(amountInput),
                    new ActionRowBuilder().addComponents(usernameInput)
                );

                return await interaction.showModal(modal);
            }

            // Dynamic Product Buy Button
            if (customId.startsWith('buy_product_')) {
                const productId = customId.replace('buy_product_', '');
                try {
                    const product = await Product.findById(productId);
                    if (!product || !product.active) {
                        return interaction.reply({ content: '❌ Produk tidak ditemukan atau sudah tidak aktif.', ephemeral: true });
                    }

                    const modal = new ModalBuilder()
                        .setCustomId(`submit_product_buy:${productId}`)
                        .setTitle(`Beli ${product.name}`);

                    // Dynamically build fields
                    const rows = [];
                    for (const field of product.fields) {
                        const input = new TextInputBuilder()
                            .setCustomId(field.customId)
                            .setLabel(field.label)
                            .setPlaceholder(field.placeholder || '')
                            .setStyle(field.style === 'PARAGRAPH' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                            .setRequired(field.required ?? true);

                        rows.push(new ActionRowBuilder().addComponents(input));
                    }

                    modal.addComponents(rows);
                    return await interaction.showModal(modal);
                } catch (err) {
                    logger.error('[InteractionCreate] Error preparing dynamic buy modal:', err);
                    return interaction.reply({ content: '❌ Terjadi kesalahan saat memuat form pembelian.', ephemeral: true });
                }
            }

            // Copy Username Action
            if (customId.startsWith('copy_user_')) {
                const orderId = customId.replace('copy_user_', '');
                const order = await Order.findOne({ orderId });
                if (!order) {
                    return interaction.reply({ content: '❌ Data pesanan tidak ditemukan.', ephemeral: true });
                }
                const username = order.details?.username || order.details?.robloxUsername || order.details?.displayName || '-';
                return interaction.reply({ content: `\`${username}\``, ephemeral: true });
            }

            // Robux Staff Delivery Action (Vilog & Visend)
            
            if (customId.startsWith('vouch_star_')) {
                const parts = customId.split('_');
                const rating = parseInt(parts[2]);
                const orderId = parts.slice(3).join('_');
                
                const order = await Order.findOne({ orderId });
                if (!order) return interaction.reply({ content: '❌ Pesanan tidak ditemukan.', ephemeral: true });
                if (order.status !== 'success') return interaction.reply({ content: '❌ Anda hanya dapat memberikan ulasan untuk pesanan yang telah sukses.', ephemeral: true });
                if (order.reviewGiven) return interaction.reply({ content: '❌ Anda sudah memberikan ulasan untuk pesanan ini.', ephemeral: true });

                const modal = new ModalBuilder()
                    .setCustomId(`vouch_modal_${rating}_${orderId}`)
                    .setTitle(`Ulasan (${rating} Bintang)`);
                
                const commentInput = new TextInputBuilder()
                    .setCustomId('review_comment')
                    .setLabel('💬 Ulasan Anda (Opsional)')
                    .setPlaceholder('Bagikan pengalaman Anda bersama LyraBlox...')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(300)
                    .setRequired(false);
                
                modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
                return await interaction.showModal(modal);
            }

            if (customId.startsWith('robux_deliver_') || customId.startsWith('vilog_deliver_')) {
                const orderId = customId.replace('robux_deliver_', '').replace('vilog_deliver_', '');

                // MUST defer immediately to prevent interaction timeout (>3s)
                await interaction.deferReply({ ephemeral: true });

                try {
                    const staffRoleId = await settingsService.get('staff_role_id');
                    const adminRoleId = await settingsService.get('admin_role_id');
                    const ownerRoleId = await settingsService.get('owner_role_id');

                    const isAuthorized = interaction.member.roles.cache.has(staffRoleId) || 
                                         interaction.member.roles.cache.has(adminRoleId) || 
                                         interaction.member.roles.cache.has(ownerRoleId) ||
                                         interaction.member.permissions.has('Administrator');

                    if (!isAuthorized) {
                        return interaction.editReply('❌ Anda tidak memiliki izin untuk memproses pesanan ini.');
                    }
                    // ATOMIC UPDATE: Mengunci transaksi agar tidak terjadi double processing
                    let order = await Order.findOneAndUpdate(
                        { orderId, status: { $ne: 'success' } },
                        { $set: { status: 'success' } },
                        { new: true }
                    );

                    if (!order) {
                        const existing = await Order.findOne({ orderId });
                        if (!existing) {
                            return interaction.editReply('❌ Data pesanan tidak ditemukan di database.');
                        } else {
                            return interaction.editReply('❌ Pesanan ini sudah diselesaikan sebelumnya.');
                        }
                    }

                    // Update Voice Status
                    const voiceStatusService = require('../services/voiceStatusService');
                    voiceStatusService.updateAllVoiceStatuses(interaction.client);

                    // Bulk support: Find all other pending orders in this ticket and mark them success too
                    const pendingOrders = await Order.find({ channelId: interaction.channel.id, status: { $ne: 'success' } });
                    if (pendingOrders.length > 0) {
                        await Order.updateMany(
                            { channelId: interaction.channel.id, status: { $ne: 'success' } },
                            { $set: { status: 'success' } }
                        );
                        
                        // We must find ALL orders in this ticket, including the one we just updated to 'success', to get the absolute correct total
                        const allOrdersInTicket = await Order.find({ channelId: interaction.channel.id, status: 'success' });
                        
                        const totalPrice = allOrdersInTicket.reduce((sum, o) => sum + o.price, 0);
                        let totalRobux = allOrdersInTicket.reduce((sum, o) => {
                            let amt = 0;
                            if (o.details) {
                                const pKey = Object.keys(o.details).find(k => k.toLowerCase().includes('amount') || k.toLowerCase().includes('qty') || k.toLowerCase().includes('paket') || k.toLowerCase().includes('robux'));
                                if (pKey) {
                                    const val = o.details[pKey].toString().replace(/[^0-9]/g, '');
                                    amt = parseInt(val, 10) || 0;
                                }
                            }
                            return sum + amt;
                        }, 0);
                        
                        order.price = totalPrice;
                        if (order.details) {
                            order.details.amount = totalRobux;
                            
                            // Also update the specific pKey if it was something else, but ensure amount is definitely set
                            const pKey = Object.keys(order.details).find(k => k.toLowerCase().includes('paket') || k.toLowerCase().includes('qty'));
                            if (pKey && pKey !== 'amount') order.details[pKey] = totalRobux;
                        }
                    }
 
                    // Update ticket message embed inside channel to Success
                    const originalMsg = interaction.message;
                    if (originalMsg && originalMsg.embeds.length > 0) {
                        const oldEmbed = originalMsg.embeds[0];
                        const newEmbed = EmbedBuilder.from(oldEmbed)
                            .setColor('#00ff00');
                        
                        if (oldEmbed.description) {
                            const desc = oldEmbed.description;
                            const updatedDesc = desc.replace(/Status:\s*🟢\s*\*Paid\*/i, 'Status: **✅ Success**')
                                                   .replace(/Status:\s*🟢\s*Paid/i, 'Status: **✅ Success**')
                                                   .replace(/Status:\s*🟡\s*\*Menunggu Pembayaran\*/i, 'Status: **✅ Success**')
                                                   .replace(/Status:\s*🟡\s*Menunggu Pembayaran/i, 'Status: **✅ Success**');
                            newEmbed.setDescription(updatedDesc);
                        }
 
                        if (oldEmbed.fields && oldEmbed.fields.length > 0) {
                            const updatedFields = oldEmbed.fields.map(f => {
                                if (f.name.toLowerCase().includes('status')) {
                                    return { name: f.name, value: '✅ Success', inline: f.inline };
                                }
                                return f;
                            });
                            newEmbed.setFields(updatedFields);
                        }
 
                        const closeBtn = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                        );
                        await originalMsg.edit({ embeds: [newEmbed], components: [closeBtn] }).catch(() => {});
                    }

                    // Transaction Log — only on Success
                    const logChannelId = await settingsService.get('log_channel_id', '1534624789065498795');
                    const logChannel = logChannelId ? await client.channels.fetch(logChannelId).catch(() => null) : null;
                    if (logChannel) {
                        const customer = await client.users.fetch(order.userId).catch(() => null);
                        const avatarURL = customer ? customer.displayAvatarURL({ dynamic: true, size: 256 }) : client.user.defaultAvatarURL;

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
                                { name: '👨‍💼 Staff', value: `<@${interaction.user.id}>`, inline: true },
                                { name: '\u200b', value: '\u200b', inline: true },
                                { name: '📦 Produk', value: order.productName || 'Robux Via Login', inline: true },
                                ...(order.productName === 'Gift In Game' ? [
                                    { name: '🎮 Game', value: order.details?.gameLink || '-', inline: true },
                                    { name: '🎁 Gamepass', value: order.details?.gamepassName || '-', inline: true },
                                    { name: '💎 Jumlah', value: `${order.details?.amount || 0} Robux`, inline: true },
                                    { name: '💰 Total', value: `Rp ${order.price.toLocaleString('id-ID')}`, inline: true },
                                    { name: '📌 Status', value: '✅ Success', inline: true },
                                ] : [
                                    { name: '🎁 Paket', value: order.details?.package === 'Custom' ? 'Custom' : `${order.details?.amount || 0} Robux`, inline: true },
                                    ...(order.details?.package === 'Custom' ? [{ name: '💎 Jumlah', value: `${order.details?.amount || 0} Robux`, inline: true }] : [{ name: '\u200b', value: '\u200b', inline: true }]),
                                    { name: '💰 Total', value: `Rp ${order.price.toLocaleString('id-ID')}`, inline: true },
                                    { name: '📌 Status', value: '✅ Success', inline: true },
                                    { name: '\u200b', value: '\u200b', inline: true },
                                ]),
                                { name: '🆔 Order ID', value: `\`${order.orderId}\``, inline: true },
                                { name: '🕒 Waktu', value: timeStr, inline: true },
                                { name: '\u200b', value: '\u200b', inline: true }
                            )
                            .setFooter({ text: 'LyraBlox • Transaction Log' })
                            .setColor('#2ecc71')
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                    }

                    // Send Customer DM
                    try {
                        const customer = await client.users.fetch(order.userId);
                        if (customer) {
                            const brandingName = await settingsService.get('branding_name', 'LyraBlox');
                            const productNameDisplay = order.productName === 'Gift In Game' ? 'Gift In Game' : (order.productName || 'Robux Via Login');
                            const dmMsg = `🎉 **Pesanan ${productNameDisplay} Anda telah berhasil diproses!**\n\n` +
                                          `📦 **Order ID:** ${order.orderId}\n` +
                                          `💰 **Jumlah:** ${order.details?.amount || 0} Robux\n` +
                                          `💵 **Total Pembayaran:** Rp ${order.price.toLocaleString('id-ID')}\n\n` +
                                          `Terima kasih telah mempercayai **${brandingName}**! ✨`;
                            await customer.send(dmMsg);
                        }
                    } catch (e) {
                        logger.warn(`Failed to DM customer ${order.userId}:`, e.message);
                    }

                    await interaction.editReply('✅ Pesanan berhasil diproses.');
                    await interaction.channel.send(
                        `✅ **Pesanan berhasil diproses.**\n` +
                        `Terima kasih telah berbelanja di LyraBlox.\n\n` +
                        `Ticket akan ditutup otomatis dalam 60 detik.`
                    );
                    const reviewPanel = buildReviewPanel(order.orderId);
                    await interaction.channel.send(reviewPanel);
                    try { const c = await client.users.fetch(order.userId); if(c) await c.send(reviewPanel).catch(()=>{}); } catch(e) {}
                    await Ticket.findOneAndUpdate({ ticketId: interaction.channel.id }, { status: 'closed' });

                    setTimeout(() => {
                        interaction.channel.delete().catch(() => {});
                    }, 60000);

                } catch (err) {
                    logger.error('[InteractionCreate] Error delivering Vilog order:', err);
                    return interaction.editReply('❌ Terjadi kesalahan saat memproses pengiriman.');
                }
                return;
            }

            // Standard Product buy actions
            if (customId.startsWith('order_deliver_') || customId.startsWith('order_cancel_')) {
                const isDeliver = customId.startsWith('order_deliver_');
                const orderId = customId.replace(isDeliver ? 'order_deliver_' : 'order_cancel_', '');

                const staffRoleId = await settingsService.get('staff_role_id');
                const adminRoleId = await settingsService.get('admin_role_id');
                const ownerRoleId = await settingsService.get('owner_role_id');

                const member = interaction.member;
                const isAuthorized = member.roles.cache.has(staffRoleId) || 
                                     member.roles.cache.has(adminRoleId) || 
                                     member.roles.cache.has(ownerRoleId) ||
                                     member.permissions.has('Administrator');

                if (!isAuthorized) {
                    return interaction.reply({ content: '❌ Anda tidak memiliki izin untuk memproses pesanan ini.', ephemeral: true });
                }

                await interaction.deferReply();

                try {
                    const brandingName = await settingsService.get('branding_name', 'LyraBlox');

                    let order;
                    if (isDeliver) {
                        // ATOMIC UPDATE: Mengunci status menjadi success
                        order = await Order.findOneAndUpdate(
                            { orderId, status: { $in: ['pending', 'paid'] } },
                            { $set: { status: 'success' } },
                            { new: true }
                        );
                        
                        if (order) {
                            const pendingOrders = await Order.find({ channelId: interaction.channel.id, status: { $in: ['pending', 'paid'] } });
                            if (pendingOrders.length > 0) {
                                await Order.updateMany(
                                    { channelId: interaction.channel.id, status: { $in: ['pending', 'paid'] } },
                                    { $set: { status: 'success' } }
                                );
                                
                                const allOrders = [order, ...pendingOrders];
                                const totalPrice = allOrders.reduce((sum, o) => sum + o.price, 0);
                                let totalRobux = allOrders.reduce((sum, o) => {
                                    let amt = 0;
                                    if (o.details) {
                                        const pKey = Object.keys(o.details).find(k => k.toLowerCase().includes('amount') || k.toLowerCase().includes('qty') || k.toLowerCase().includes('paket') || k.toLowerCase().includes('robux'));
                                        if (pKey) {
                                            const val = o.details[pKey].toString().replace(/[^0-9]/g, '');
                                            amt = parseInt(val, 10) || 0;
                                        }
                                    }
                                    return sum + amt;
                                }, 0);
                                
                                order.price = totalPrice;
                                if (order.details) {
                                    const pKey = Object.keys(order.details).find(k => k.toLowerCase().includes('amount') || k.toLowerCase().includes('qty') || k.toLowerCase().includes('paket') || k.toLowerCase().includes('robux'));
                                    if (pKey) order.details[pKey] = `${totalRobux} Robux`;
                                }
                            }
                        }
                    } else {
                        // ATOMIC DELETE: Menghapus jika status masih valid
                        order = await Order.findOneAndDelete(
                            { orderId, status: { $in: ['pending', 'paid'] } }
                        );
                    }

                    // Update Voice Status
                    const voiceStatusService = require('../services/voiceStatusService');
                    voiceStatusService.updateAllVoiceStatuses(interaction.client);

                    if (!order) {
                        const existing = await Order.findOne({ orderId });
                        if (!existing) return interaction.editReply('❌ Data pesanan tidak ditemukan di database.');
                        return interaction.editReply(`❌ Pesanan ini sudah berstatus: **${existing.status.toUpperCase()}**.`);
                    }

                    if (isDeliver) {

                        // Send DM to Customer
                        try {
                            const customer = await client.users.fetch(order.userId);
                            if (customer) {
                                const dmMsg = `🎉 **Pesanan Anda telah berhasil diproses!**\n\n` +
                                              `📦 **Order ID:** ${order.orderId}\n` +
                                              `🛍️ **Produk:** ${order.productName}\n` +
                                              `💵 **Total Pembayaran:** Rp ${order.price.toLocaleString('id-ID')}\n\n` +
                                              `Terima kasih telah mempercayai **${brandingName}**.\n` +
                                              `Kami berharap dapat melayani Anda kembali! ✨`;
                                await customer.send(dmMsg);
                            }
                        } catch (e) {
                            logger.warn(`Failed to DM customer ${order.userId}:`, e.message);
                        }

                        // Update ticket message embed
                        const originalMsg = interaction.message;
                        if (originalMsg && originalMsg.embeds.length > 0) {
                            const oldEmbed = originalMsg.embeds[0];
                            const newEmbed = EmbedBuilder.from(oldEmbed)
                                .setColor('#00ff00');
                            
                            if (oldEmbed.description) {
                                const desc = oldEmbed.description;
                                const updatedDesc = desc.replace(/Status:\s*🟡\s*\*Menunggu Pembayaran\*/i, 'Status: **✅ Success**')
                                                       .replace(/Status:\s*🟡\s*Menunggu Pembayaran/i, 'Status: **✅ Success**')
                                                       .replace(/Status:\s*🟢\s*\*Paid\*/i, 'Status: **✅ Success**')
                                                       .replace(/Status:\s*🟢\s*Paid/i, 'Status: **✅ Success**')
                                                       .replace('🟡 Pending', '✅ Success')
                                                       .replace('🟢 Delivered / Completed', '✅ Success');
                                newEmbed.setDescription(updatedDesc);
                            }

                            if (oldEmbed.fields && oldEmbed.fields.length > 0) {
                                const updatedFields = oldEmbed.fields.map(f => {
                                    if (f.name.toLowerCase().includes('status')) {
                                        return { name: f.name, value: '✅ Success', inline: f.inline };
                                    }
                                    return f;
                                });
                                newEmbed.setFields(updatedFields);
                            }
                            
                            const closeBtn = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                            );

                            await originalMsg.edit({ embeds: [newEmbed], components: [closeBtn] }).catch(() => {});
                        }

                        // Transaction Log — only on Success
                        const logChannelId = await settingsService.get('log_channel_id', '1534624789065498795');
                        const logChannel = logChannelId ? await client.channels.fetch(logChannelId).catch(() => null) : null;
                        if (logChannel) {
                            const customer = await client.users.fetch(order.userId).catch(() => null);
                            const avatarURL = customer ? customer.displayAvatarURL({ dynamic: true, size: 256 }) : client.user.defaultAvatarURL;

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
                                    { name: '👨‍💼 Staff', value: `<@${interaction.user.id}>`, inline: true },
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
                                logger.error('[InteractionCreate] Error updating leaderboard:', err);
                            }
                        }

                        await interaction.editReply('✅ Pesanan berhasil diproses.');
                        await interaction.channel.send('✅ **Pesanan telah selesai diproses.**\n\nTicket ini akan ditutup otomatis dalam 60 detik.');
                        const reviewPanel = buildReviewPanel(order.orderId);
                        await interaction.channel.send(reviewPanel);
                        try { const c = await client.users.fetch(order.userId); if(c) await c.send(reviewPanel).catch(()=>{}); } catch(e) {}
                        await Ticket.findOneAndUpdate({ ticketId: interaction.channel.id }, { status: 'closed' });

                        setTimeout(() => {
                            interaction.channel.delete().catch(() => {});
                        }, 60000);
                    } else {
                        // Order telah dihapus secara atomic via findOneAndDelete di atas
                        order.status = 'cancelled';

                        // Send DM to Customer
                        try {
                            const customer = await client.users.fetch(order.userId);
                            if (customer) {
                                const dmMsg = `❌ **Pesanan Anda telah dibatalkan.**\n\n` +
                                              `📦 **Order ID:** ${order.orderId}\n` +
                                              `🛍️ **Produk:** ${order.productName}\n\n` +
                                              `Jika ada pertanyaan, silakan hubungi admin di server **${brandingName}**.`;
                                await customer.send(dmMsg);
                            }
                        } catch (e) {
                            logger.warn(`Failed to DM customer ${order.userId}:`, e.message);
                        }

                        // Update ticket message
                        const originalMsg = interaction.message;
                        if (originalMsg && originalMsg.embeds.length > 0) {
                            const oldEmbed = originalMsg.embeds[0];
                            const newEmbed = EmbedBuilder.from(oldEmbed)
                                .setColor('#ff0000');
                            
                            if (oldEmbed.description) {
                                newEmbed.setDescription(
                                    oldEmbed.description
                                        .replace('🟡 Pending', '🔴 Cancelled')
                                        .replace('🟢 Paid', '🔴 Cancelled')
                                );
                            }

                            if (oldEmbed.fields && oldEmbed.fields.length > 0) {
                                const updatedFields = oldEmbed.fields.map(f => {
                                    if (f.name.toLowerCase().includes('status')) {
                                        return { name: f.name, value: '🔴 Cancelled', inline: f.inline };
                                    }
                                    return f;
                                });
                                newEmbed.setFields(updatedFields);
                            }

                            const closeBtn = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                            );

                            await originalMsg.edit({ embeds: [newEmbed], components: [closeBtn] }).catch(() => {});
                        }

                        await interaction.editReply('❌ Pesanan telah dibatalkan. Tiket ini akan ditutup otomatis dalam 10 detik.');
                        await Ticket.findOneAndUpdate({ ticketId: interaction.channel.id }, { status: 'closed' });

                        setTimeout(() => {
                            interaction.channel.delete().catch(() => {});
                        }, 10000);
                    }
                } catch (err) {
                    logger.error('[InteractionCreate] Error processing order action:', err);
                    return interaction.editReply('❌ Terjadi kesalahan saat memproses aksi pesanan.');
                }
            }

            // Ticket Close Confirmation
            if (customId === 'ticket_close') {
                const staffRoleId = await settingsService.get('staff_role_id');
                const adminRoleId = await settingsService.get('admin_role_id');
                const ownerRoleId = await settingsService.get('owner_role_id');

                const member = await interaction.guild.members.fetch(interaction.user.id);
                const isOwner = interaction.guild.ownerId === interaction.user.id;
                const isAdmin = member.permissions.has('Administrator');
                const isStaff = member.roles.cache.has(staffRoleId) ||
                                member.roles.cache.has(adminRoleId) ||
                                member.roles.cache.has(ownerRoleId) ||
                                isOwner || isAdmin;

                if (!isStaff) {
                    return interaction.reply({ content: '❌ Hanya staf yang dapat menutup tiket ini.', ephemeral: true });
                }

                const confirmEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Konfirmasi Penutupan Ticket')
                    .setDescription('Apakah Anda yakin ingin menutup Ticket ini?')
                    .setColor('#ffaa00');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close_confirm')
                        .setLabel('Ya')
                        .setEmoji('✅')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('ticket_close_cancel')
                        .setLabel('Batal')
                        .setEmoji('❌')
                        .setStyle(ButtonStyle.Danger)
                );

                return await interaction.reply({ embeds: [confirmEmbed], components: [row] });
            }

            // Ticket Close Cancel
            if (customId === 'ticket_close_cancel') {
                const staffRoleId = await settingsService.get('staff_role_id');
                const adminRoleId = await settingsService.get('admin_role_id');
                const ownerRoleId = await settingsService.get('owner_role_id');

                const member = await interaction.guild.members.fetch(interaction.user.id);
                const isOwner = interaction.guild.ownerId === interaction.user.id;
                const isAdmin = member.permissions.has('Administrator');
                const isStaff = member.roles.cache.has(staffRoleId) ||
                                member.roles.cache.has(adminRoleId) ||
                                member.roles.cache.has(ownerRoleId) ||
                                isOwner || isAdmin;

                if (!isStaff) {
                    return interaction.reply({ content: '❌ Hanya staf yang dapat membatalkan penutupan tiket ini.', ephemeral: true });
                }

                return await interaction.update({ content: '❌ Penutupan tiket dibatalkan.', embeds: [], components: [] });
            }

            // Ticket Close Confirm Exec
            if (customId === 'ticket_close_confirm') {
                const staffRoleId = await settingsService.get('staff_role_id');
                const adminRoleId = await settingsService.get('admin_role_id');
                const ownerRoleId = await settingsService.get('owner_role_id');

                const member = await interaction.guild.members.fetch(interaction.user.id);
                const isOwner = interaction.guild.ownerId === interaction.user.id;
                const isAdmin = member.permissions.has('Administrator');
                const isStaff = member.roles.cache.has(staffRoleId) ||
                                member.roles.cache.has(adminRoleId) ||
                                member.roles.cache.has(ownerRoleId) ||
                                isOwner || isAdmin;

                if (!isStaff) {
                    return interaction.reply({ content: '❌ Hanya staf yang dapat menutup tiket ini.', ephemeral: true });
                }

                const channelId = interaction.channel.id;
                if (activeClosures.has(channelId)) {
                    return interaction.reply({ content: '⚠️ Proses penutupan tiket sedang berjalan.', ephemeral: true });
                }
                activeClosures.add(channelId);

                await Ticket.findOneAndUpdate({ ticketId: channelId }, { status: 'closed' }).catch(() => {});

                let secondsLeft = 60;
                const countdownEmbed = new EmbedBuilder()
                    .setDescription(`🔒 Ticket akan ditutup otomatis dalam:\n**${secondsLeft} Detik**`)
                    .setColor('#ff0000');

                await interaction.update({ embeds: [countdownEmbed], components: [] });

                const interval = setInterval(async () => {
                    secondsLeft -= 10;
                    if (secondsLeft <= 0) {
                        clearInterval(interval);
                        activeClosures.delete(channelId);
                        
                        const channel = interaction.guild.channels.cache.get(channelId);
                        if (channel) {
                            await channel.delete().catch(() => {});
                        }
                    } else {
                        const updateEmbed = new EmbedBuilder()
                            .setDescription(`🔒 Ticket akan ditutup otomatis dalam:\n**${secondsLeft} Detik**`)
                            .setColor('#ff0000');
                        await interaction.editReply({ embeds: [updateEmbed] }).catch(() => {
                            clearInterval(interval);
                            activeClosures.delete(channelId);
                        });
                    }
                }, 10000);
                return;
            }

            // Update Payout Status Eligibility Check
            if (customId.startsWith('check_eligibility_')) {
                await interaction.deferReply({ ephemeral: true });
                const targetDiscordId = customId.replace('check_eligibility_', '');

                const dbUser = await User.findOne({ discordId: targetDiscordId });
                if (!dbUser) {
                    return interaction.editReply('❌ Data user tidak ditemukan di database.');
                }

                const groupId = await settingsService.get('roblox_group_id', process.env.GROUP_ID);
                if (groupId && dbUser.robloxId) {
                    try {
                        const rank = await noblox.getRankInGroup(parseInt(groupId), dbUser.robloxId).catch(() => 0);
                        if (rank === 0) {
                            return interaction.editReply(`⚠️ Akun Roblox **@${dbUser.robloxUsername}** belum bergabung ke grup Roblox kami. Silakan masuk ke grup terlebih dahulu untuk bisa menerima payout!`);
                        }
                    } catch (err) {
                        console.error('Failed to check group rank:', err);
                    }
                }

                const joinedAt = dbUser.createdAt || new Date();
                const diffTime = Math.abs(new Date() - joinedAt);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                const roleId = await settingsService.get('eligible_role_id', process.env.ELIGIBLE_ROLE_ID);
                const member = await interaction.guild.members.fetch(targetDiscordId).catch(() => null);

                if (diffDays >= 14 || dbUser.eligibleForPayout) {
                    dbUser.eligibleForPayout = true;
                    await dbUser.save();

                    if (roleId && member) {
                        try {
                            if (!member.roles.cache.has(roleId)) {
                                await member.roles.add(roleId);
                            }
                        } catch (err) {
                            console.error('Failed to add eligible role:', err);
                        }
                    }

                    const oldEmbed = interaction.message.embeds[0];
                    if (oldEmbed) {
                        const embed = EmbedBuilder.from(oldEmbed);
                        const fields = oldEmbed.fields.map(f => {
                            if (f.name.includes('Eligible Date')) {
                                return { name: '✅ Status Eligibility', value: '🎉 **ELIGIBLE (Sudah +14 Hari)**', inline: true };
                            }
                            return f;
                        });
                        embed.setFields(fields);
                        embed.setColor('#00ff00');

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`check_eligibility_${targetDiscordId}`)
                                .setLabel('✅ Eligible')
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(true)
                        );

                        await interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => {});
                    }

                    return interaction.editReply('🎉 Sukses! Akun telah terverifikasi sebagai **Eligible** dan role telah diberikan.');
                } else {
                    return interaction.editReply(`⏳ Akun belum memenuhi syarat durasi server (butuh 14 hari).\n\n• Roblox: **@${dbUser.robloxUsername}**\n• Durasi bergabung: **${diffDays} hari**\n• Sisa waktu: **${14 - diffDays} hari** lagi.`);
                }
            }

            // Tutorial V2L
            if (customId === 'tutorial_v2l') {
                return interaction.reply({
                    content: `# 🔐・Aktifkan Verifikasi 2 Langkah (V2L)\n\n> **V2L wajib diaktifkan untuk membantu menaikkan limit penerima Robux.** 📈\n\n## 📖 Cara Mengaktifkan\n\n① **Buka Menu**\nTekan ikon ☰ **(garis tiga)** di pojok kiri atas Roblox.\n② **Masuk ke Pengaturan**\nScroll ke bawah, lalu pilih **⚙️ Settings.**\n③ **Pilih Informasi Akun**\nMasuk ke menu **Account Info.**\n④ **Buka Keamanan**\nTekan **Account Info** di bagian atas, lalu ubah ke menu **Security.**\n⑤ **Aktifkan V2L**\nScroll ke bagian **Verifikasi 2 Langkah**, lalu pilih salah satu metode berikut:\n\n### 📧 Verifikasi Email (Disarankan)\n- Pilih **Email (Secure)**.\n- Masukkan kode verifikasi yang dikirim ke email akunmu.\n- Selesai ✅\n\n### 📱 Aplikasi Authenticator (Paling Aman)\n- Pilih **Authenticator App (Very Secure)**.\n- Scan QR Code menggunakan:\n> • Google Authenticator  \n> • Microsoft Authenticator  \n> • Authy\n- Masukkan kode 6 digit yang muncul.\n- Selesai ✅\n\n## ⚠️ Perhatian\n- Pastikan email akun sudah **Verified**.\n- Jangan pernah membagikan kode verifikasi maupun Recovery Code kepada siapa pun.\n- Setelah V2L aktif, beri tahu admin agar pesanan bisa segera diproses.\n\n🎥 **Video Tutorial:** https://youtu.be/R9yrdvo6Zs8?si=KuY7I_L0ZrZN5LlD`,
                    ephemeral: true
                });
            }

            // Tutorial Cek Limit
            if (customId === 'tutorial_cek_limit') {
                return interaction.reply({
                    content: `# 📊・Cara Cek Riwayat Penerimaan Robux\n\n> Digunakan untuk mengecek apakah akunmu **masih bisa menerima Robux** atau **sudah mencapai batas transfer bulanan**.\n\n## 📖 Cara Mengecek\n\n**1.** Buka Roblox, lalu tekan **☰** (garis tiga) di pojok kiri atas.\n\n**2.** Scroll ke bawah, lalu pilih **⚙️ Settings**.\n\n**3.** Masuk ke menu **Account Info**.\n\n**4.** Tekan **Account Info** di bagian atas, lalu pilih **Robux**.\n\n**5.** Pastikan **Transfer Limits** menunjukkan:\n> 📅 Daily Limit : **5.000 Robux**  \n> 📅 Monthly Limit : **10.000 Robux**\n\n**6.** Tekan **Transaction History**.\n\n**7.** Lihat bagian **Robux Transfers Received**.\n\n### ✅ Jika angkanya masih di bawah **10.000 Robux**\n> Akun **masih bisa menerima Robux**.\n\n### ❌ Jika total sudah **10.000 Robux atau lebih**\n> Akun **sudah mencapai batas transfer bulanan** dan **belum bisa menerima Robux lagi** sampai limit di-reset oleh Roblox.\n\n## ⚠️ Penting\n- Limit **10.000 Robux/bulan** berlaku untuk akun yang sudah mengaktifkan **Verifikasi 2 Langkah (2SV)**.\n- Sebelum memesan, pastikan limit akunmu masih tersedia agar proses transaksi tidak gagal.`,
                    ephemeral: true
                });
            }

            // Order Confirmation (Confirm & Cancel)
            if (customId.startsWith('cancel_order_')) {
                const sessionId = customId.replace('cancel_order_', '');
                orderSessions.delete(sessionId);
                return interaction.reply({
                    content: '❌ Sesi dibatalkan. Data tidak disimpan. Silakan tekan tombol Order di channel kembali jika ingin mengulang.',
                    ephemeral: true
                });
            }

            if (customId.startsWith('confirm_order_')) {
                const sessionId = customId.replace('confirm_order_', '');
                const session = orderSessions.get(sessionId);

                if (!session) {
                    return interaction.reply({
                        content: '❌ Sesi konfirmasi telah kedaluwarsa atau tidak valid. Silakan order ulang.',
                        ephemeral: true
                    });
                }

                await interaction.deferReply({ ephemeral: true });

                try {
                    // Sequential Order ID
                    const totalOrders = await Order.countDocuments();
                    const orderId = `LB-${String(totalOrders + 1).padStart(6, '0')}`;

                    // Determine Category
                    const categoryKey = session.type === 'gig' ? 'gig_category_id' : (session.type === 'visend' ? 'visend_category_id' : 'vilog_category_id');
                    let categoryId = await settingsService.get(categoryKey);
                    if (!categoryId) {
                        categoryId = await settingsService.get('global_ticket_category_id');
                    }
                    const categoryChannel = categoryId ? await interaction.guild.channels.fetch(categoryId).catch(() => null) : null;

                    // Permissions
                    const staffRoleId = await settingsService.get('staff_role_id');
                    const adminRoleId = await settingsService.get('admin_role_id');
                    const ownerRoleId = await settingsService.get('owner_role_id');

                    const permissions = [
                        { id: interaction.guild.id, deny: ['ViewChannel'] },
                        { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                        { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] }
                    ];

                    if (staffRoleId) permissions.push({ id: staffRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
                    if (adminRoleId && adminRoleId !== staffRoleId) permissions.push({ id: adminRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
                    if (ownerRoleId && ownerRoleId !== staffRoleId && ownerRoleId !== adminRoleId) permissions.push({ id: ownerRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });

                    const isGIG = session.type === 'gig';
                    const isVisend = session.type === 'visend';
                    
                    const productName = isGIG ? 'Gift In Game' : (isVisend ? 'Robux Via Send' : 'Robux Via Login');
                    const amountDisplay = isGIG ? session.amount : session.amount;

                    // Create Ticket Channel
                    const channelPrefix = isGIG ? 'gig' : (isVisend ? 'visend' : 'vilog');
                    const channelName = `${channelPrefix}-${amountDisplay}r-${interaction.user.username}`;
                    const channel = await interaction.guild.channels.create({
                        name: channelName,
                        type: 0, // GuildText
                        parent: categoryChannel ? categoryChannel.id : null,
                        permissionOverwrites: permissions
                    });

                    // Create DB Records
                    await Order.create({
                        orderId,
                        userId: interaction.user.id,
                        productName,
                        price: session.price,
                        subtotal: session.price,
                        rounding: 0,
                        status: 'pending',
                        channelId: channel.id,
                        details: isGIG ? {
                            gameLink: session.gameLink,
                            gamepassName: session.gamepassName,
                            amount: session.amount,
                            price: session.price,
                            rate: session.rate
                        } : {
                            username: session.robloxUsername,
                            password: session.robloxPassword,
                            amount: session.amount,
                            price: session.price,
                            package: session.isCustom ? 'Custom' : undefined
                        }
                    });

                    await Ticket.create({
                        ticketId: channel.id,
                        ownerId: interaction.user.id,
                        productName,
                        orderId,
                        status: 'open'
                    });

                    // Update Voice Status
                    const voiceStatusService = require('../services/voiceStatusService');
                    voiceStatusService.updateAllVoiceStatuses(interaction.client);
                    const { AttachmentBuilder } = require('discord.js');
                    const path = require('path');
                    const qrPath = path.join(__dirname, '../../Public/LyraPayment.jpg');
                    const qrFilename = `qris_${Date.now()}.jpg`;
                    const qrAttachment = new AttachmentBuilder(qrPath, { name: qrFilename });

                    let ticketEmbed;
                    if (isGIG) {
                        ticketEmbed = new EmbedBuilder()
                            .setTitle('🛒 Pesanan LyraBlox')
                            .setDescription(
                                `Halo <@${interaction.user.id}>,\n\n` +
                                `Terima kasih telah menggunakan layanan Gift In Game LyraBlox.\n` +
                                `Pesanan Anda berhasil dibuat.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                                `📦 **Detail Pesanan**`
                            )
                            .setColor('#f43f5e')
                            .addFields(
                                { name: '📦 Produk', value: 'Gift In Game', inline: true },
                                { name: '🎮 Game / Map', value: `\`${session.gameLink || '-'}\``, inline: true },
                                { name: '🎁 Gamepass', value: `\`${session.gamepassName || '-'}\``, inline: true },
                                { name: '💎 Harga Gamepass', value: `\`${session.amount.toLocaleString('id-ID')} Robux\``, inline: true },
                                { name: '💰 Total Pembayaran', value: `\`Rp ${session.price.toLocaleString('id-ID')}\``, inline: true },
                                { name: '👤 Username', value: `\`${session.robloxUsername || '-'}\``, inline: true },
                                { name: '📌 Status', value: '🟡 Pending', inline: true },
                                { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                                { name: '💳 Pembayaran', value: `Silakan lakukan pembayaran sesuai dengan total yang tertera di atas.\n\n🟦 **GoPay**\n\`081393625527\``, inline: false },
                                { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                                { 
                                    name: '📝 Catatan Pembayaran', 
                                    value: 
                                        '• Maksimal pembayaran melalui QRIS adalah Rp500.000 untuk setiap transaksi.\n' +
                                        '• Untuk transaksi di atas Rp500.000, silakan lakukan pembayaran lebih dari satu kali, atau gunakan satu kali pembayaran dengan tambahan biaya QRIS sebesar 0,3%.\n' +
                                        '• Apabila melakukan transfer ke GoPay menggunakan Bank atau E-Wallet selain GoPay, akan dikenakan biaya tambahan sebesar Rp1.000 sesuai ketentuan penyedia layanan.\n' +
                                        '• Pastikan nominal pembayaran sesuai dengan total yang tertera pada Ticket.\n' +
                                        '• Setelah pembayaran selesai, kirim bukti transfer langsung pada Ticket ini.\n' +
                                        '• Bot akan mendeteksi bukti pembayaran secara otomatis.',
                                    inline: false 
                                }
                            )

                            .setTimestamp();
                    } else {
                        ticketEmbed = new EmbedBuilder()
                            .setTitle('🛒 Pesanan LyraBlox')
                            .setDescription(
                                `Halo <@${interaction.user.id}>,\n\n` +
                                `Terima kasih telah mempercayai pembelian Robux kepada LyraBlox.\n` +
                                `Pesanan Anda berhasil dibuat.\n` +
                                `Silakan lakukan pembayaran sesuai instruksi di bawah ini.\n`
                            )
                            .addFields(
                                { name: '📦 Produk', value: productName, inline: true },
                                { name: '🎁 Paket', value: `\`${session.isCustom ? 'Custom' : session.amount.toLocaleString('id-ID') + ' Robux'}\``, inline: true },
                                ...(session.isCustom ? [{ name: '💎 Jumlah Robux', value: `\`${session.amount.toLocaleString('id-ID')} Robux\``, inline: true }] : []),
                                { name: '💰 Total', value: `\`Rp ${session.price.toLocaleString('id-ID')}\``, inline: true },
                                { name: '👤 Username', value: `\`${session.robloxUsername}\``, inline: true },
                                ...(isVisend ? [] : [{ name: '🔑 Password', value: `||${session.robloxPassword}||`, inline: true }]),
                                { name: '📌 Status', value: '🟡 Pending', inline: true },
                                { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                                { name: '💳 Pembayaran', value: `Silakan lakukan pembayaran sesuai dengan total yang tertera di atas.\n\n🟦 **GoPay**\n\`081393625527\``, inline: false },
                                { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                                { 
                                    name: '📝 Catatan Pembayaran', 
                                    value: 
                                        '• Maksimal pembayaran melalui QRIS adalah Rp500.000 untuk setiap transaksi.\n' +
                                        '• Untuk transaksi di atas Rp500.000, silakan lakukan pembayaran lebih dari satu kali, atau gunakan satu kali pembayaran dengan tambahan biaya QRIS sebesar 0,3%.\n' +
                                        '• Apabila melakukan transfer ke GoPay menggunakan Bank atau E-Wallet selain GoPay, akan dikenakan biaya tambahan sebesar Rp1.000 sesuai ketentuan penyedia layanan.\n' +
                                        '• Pastikan nominal pembayaran sesuai dengan total yang tertera pada Ticket.\n' +
                                        '• Setelah pembayaran selesai, kirim bukti transfer langsung pada Ticket ini.\n' +
                                        '• Bot akan mendeteksi bukti pembayaran secara otomatis.',
                                    inline: false 
                                }
                            )

                            .setColor('#ffaa00')
                            .setTimestamp();
                    }

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`robux_deliver_${orderId}`).setLabel('Mark Delivered').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                    );
                    
                    if (isVisend) {
                        row.addComponents(
                            new ButtonBuilder().setCustomId('tutorial_v2l').setLabel('🔐 Tutorial V2L').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tutorial_cek_limit').setLabel('📊 Cek Limit Robux').setStyle(ButtonStyle.Secondary)
                        );
                    }

                    const staffMention = staffRoleId ? `<@&${staffRoleId}>` : '';
                    const adminMention = adminRoleId ? `<@&${adminRoleId}>` : '';
                    await channel.send(`${interaction.user} | ${staffMention} ${adminMention}`);
                    await channel.send({ 
                        embeds: [ticketEmbed], 
                        components: [row]
                    });
                    await channel.send({
                        content: '📷 **QR Code Pembayaran:**',
                        files: [qrAttachment]
                    });

                    // Hapus sesi setelah sukses
                    orderSessions.delete(sessionId);

                    await interaction.editReply(`✅ Pesanan dikonfirmasi! Silakan lanjutkan pembayaran di tiket: ${channel}`);
                } catch (err) {
                    logger.error('[InteractionCreate] Error confirming order:', err);
                    return interaction.editReply('❌ Terjadi kesalahan saat memproses pesanan.');
                }
            }
        }
        
        // Helper function for Bulk Order
        const handleBulkOrder = async (i, session, activeTicket) => {
            const bulkRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`bulk_append`).setLabel('Tambah ke Tiket Aktif').setStyle(ButtonStyle.Primary)
            );
            const bulkEmbed = new EmbedBuilder()
                .setTitle('⚠️ Tiket Aktif Ditemukan')
                .setDescription(`Anda masih memiliki tiket yang belum selesai di <#${activeTicket.ticketId}>.\nSilakan tekan tombol di bawah ini untuk menambahkan pesanan baru ke tiket tersebut.`)
                .setColor('#ffaa00');
            
            const bulkReply = await i.editReply({ embeds: [bulkEmbed], components: [bulkRow] });
            const bulkCollector = bulkReply.createMessageComponentCollector({
                filter: btn => btn.user.id === i.user.id,
                time: 60000
            });
            bulkCollector.on('collect', async btn => {
                await btn.deferUpdate();
                if (btn.customId === 'bulk_append') {
                    bulkCollector.stop();
                    const newOrderId = `LB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                    await Order.create({
                        orderId: newOrderId,
                        userId: btn.user.id,
                        productName: session.type === 'gig' ? 'Gift In Game' : (session.type === 'visend' ? 'Robux Via Send' : 'Robux Via Login'),
                        price: session.price,
                        subtotal: session.price,
                        rounding: 0,
                        status: 'pending',
                        channelId: activeTicket.ticketId,
                        snapshot: { price: session.price, amount: session.amount, rate: session.rate },
                        details: session.type === 'gig' ? {
                            gameLink: session.gameLink,
                            gamepassName: session.gamepassName,
                            amount: session.amount,
                            price: session.price,
                            rate: session.rate
                        } : {
                            username: session.robloxUsername,
                            password: session.robloxPassword,
                            amount: session.amount,
                            price: session.price,
                            package: session.isCustom ? 'Custom' : undefined
                        }
                    });

                    // Update Voice Status
                    const voiceStatusService = require('../services/voiceStatusService');
                    voiceStatusService.updateAllVoiceStatuses(interaction.client);
                    
                    const channel = client.channels.cache.get(activeTicket.ticketId);
                    if (channel) {
                        let warningText = '';
                        try {
                            const messages = await channel.messages.fetch({ limit: 50 });
                            const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.components.length > 0);
                            
                            if (botMsg) {
                                const oldEmbed = botMsg.embeds[0];
                                const usernameField = oldEmbed.fields.find(f => f.name.toLowerCase().includes('username'));
                                if (usernameField) {
                                    let oldUsername = usernameField.value.replace(/`/g, '').trim();
                                    oldUsername = oldUsername.replace(/^text\s*/i, '').trim(); // Remove literal 'text' if Discord injects it
                                    if (oldUsername.toLowerCase() !== session.robloxUsername.toLowerCase()) {
                                        warningText = `\n\n⚠️ **PERINGATAN USERNAME BERBEDA:**\n- Username pesanan utama: \`${oldUsername}\`\n- Username pesanan baru: \`${session.robloxUsername}\`\n\nMohon konfirmasi jika pesanan ini memang untuk akun yang berbeda.`;
                                    }
                                }

                                const { EmbedBuilder } = require('discord.js');
                                const newEmbed = EmbedBuilder.from(oldEmbed);
                                
                                // Calculate new total from all pending orders
                                const pendingOrders = await Order.find({ channelId: activeTicket.ticketId, status: 'pending' });
                                const newTotal = pendingOrders.reduce((sum, o) => sum + o.price, 0);
                                const newAmount = pendingOrders.reduce((sum, o) => {
                                    let amt = 0;
                                    if (o.details && o.details.amount) amt = parseInt(o.details.amount) || 0;
                                    return sum + amt;
                                }, 0);
                                
                                if (oldEmbed.fields && oldEmbed.fields.length > 0) {
                                    const updatedFields = [...oldEmbed.fields];
                                    
                                    for (let i = 0; i < updatedFields.length; i++) {
                                        const fname = updatedFields[i].name.toLowerCase();
                                        if (fname.includes('paket') || fname.includes('jumlah robux') || fname.includes('harga gamepass') || fname.includes('jumlah')) {
                                            if (updatedFields[i].value.includes('Custom')) {
                                                // Keep it as custom or update if needed
                                            } else {
                                                updatedFields[i].value = `\`${newAmount.toLocaleString('id-ID')} Robux\``;
                                            }
                                        }
                                        if (fname.includes('total') || fname.includes('pembayaran')) {
                                            updatedFields[i].value = `\`Rp ${newTotal.toLocaleString('id-ID')}\``;
                                        }
                                    }

                                    // Identify where the "Total Pembayaran" or "Total" field is
                                    const totalFieldIndex = updatedFields.findIndex(f => f.name.toLowerCase().includes('total'));
                                    
                                    // Construct the new order field
                                    const productName = session.type === 'gig' ? 'Gift In Game' : (session.type === 'visend' ? 'Robux Via Send' : 'Robux Via Login');
                                    let packageLabel = session.isCustom ? 'Custom' : `${session.amount} Robux`;
                                    const orderCount = pendingOrders.length;
                                    const newOrderField = {
                                        name: `📦 Tambahan ke-${orderCount}: ${productName}`,
                                        value: `**Username:** \`${session.robloxUsername || '-'}\`\n**Paket:** \`${packageLabel}\`\n**Harga:** \`Rp ${session.price.toLocaleString('id-ID')}\``,
                                        inline: false
                                    };
                                    
                                    if (totalFieldIndex !== -1) {
                                        // Insert the new order before the total field
                                        updatedFields.splice(totalFieldIndex, 0, newOrderField);
                                    } else {
                                        updatedFields.push(newOrderField);
                                    }
                                    
                                    newEmbed.setFields(updatedFields);
                                }
                                await botMsg.edit({ embeds: [newEmbed] });
                            }
                        } catch (e) {
                            console.error('[BulkOrder] Error updating original embed', e);
                        }

                        const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
                        const path = require('path');
                        const qrPath = path.join(__dirname, '../../Public/LyraPayment.jpg');
                        const qrFilename = `qris_${Date.now()}.jpg`;
                        const qrAttachment = new AttachmentBuilder(qrPath, { name: qrFilename });
                        
                        const gigDetails = session.type === 'gig' ? `**Game / Map:** \`${session.gameLink || '-'}\`\n**Gamepass:** \`${session.gamepassName || '-'}\`\n` : '';
                        const bulkNotifyEmbed = new EmbedBuilder()
                            .setTitle('🛒 Pesanan Tambahan Diterima')
                            .setDescription(
                                `Halo <@${btn.user.id}>, pesanan baru telah ditambahkan ke tiket ini!\n\n` +
                                `**Produk:** \`${session.type === 'gig' ? 'Gift In Game' : (session.type === 'visend' ? 'Robux Via Send' : 'Robux Via Login')}\`\n` +
                                gigDetails +
                                `**Tambahan Robux:** \`${session.amount.toLocaleString('id-ID')} Robux\`\n` +
                                `**Tambahan Biaya:** \`Rp ${session.price.toLocaleString('id-ID')}\`\n\n` +
                                `*(Total tagihan pada pesan utama tiket ini telah diperbarui secara otomatis.)*\n\n` +
                                `**📝 Info Pembayaran:**\n` +
                                `Jika Anda **sudah** membayar orderan sebelumnya, Anda hanya perlu mentransfer nominal **Tambahan Biaya** di atas.\n` +
                                `Namun, jika **belum**, silakan ikuti **Total Pembayaran terbaru** yang ada di informasi pesan utama di atas.` +
                                warningText
                            )
                            .addFields(
                                { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false },
                                { name: '💳 Pembayaran QRIS', value: `Silakan scan QR Code di bawah ini.`, inline: false },
                                { 
                                    name: '📝 Syarat & Ketentuan (S&K)', 
                                    value: 
                                        '• Maksimal pembayaran melalui QRIS adalah Rp500.000 untuk setiap transaksi.\n' +
                                        '• Untuk transaksi di atas Rp500.000, silakan lakukan pembayaran lebih dari satu kali, atau gunakan satu kali pembayaran dengan tambahan biaya QRIS sebesar 0,3%.\n' +
                                        '• Apabila melakukan transfer ke GoPay menggunakan Bank atau E-Wallet selain GoPay, dikenakan biaya tambahan sebesar Rp1.000 sesuai ketentuan penyedia layanan.\n' +
                                        '• Pastikan nominal pembayaran sesuai dengan tagihan.\n' +
                                        '• Setelah pembayaran selesai, kirim bukti transfer langsung pada Ticket ini.',
                                    inline: false 
                                }
                            )

                            .setColor(warningText ? '#ffcc00' : '#00ff00')
                            .setTimestamp();
                            
                        await channel.send({ 
                            embeds: [bulkNotifyEmbed]
                        });
                        await channel.send({
                            content: '📷 **QR Code Pembayaran:**',
                            files: [qrAttachment]
                        });
                        
                        // Send plain text format for easy copying on Android
                        const plainTextFormat = `**Format Order Tambahan (Copas):**\n\`\`\`\nUsername: ${session.robloxUsername || '-'}\nPaket: ${session.amount} Robux\nHarga: Rp ${session.price.toLocaleString('id-ID')}\n\`\`\``;
                        await channel.send({ content: plainTextFormat });
                    }
                    return btn.editReply({ content: `✅ Pesanan berhasil ditambahkan ke <#${activeTicket.ticketId}>. Silakan lanjutkan pembayaran di sana.`, embeds: [], components: [] });
                }
            });
        };

        // Handle Modal Submissions
        if (interaction.isModalSubmit()) {
            const { customId } = interaction;

            if (customId === 'modal_mm_fee_create' || customId.startsWith('modal_mm_fee_edit_')) {
                await interaction.deferReply({ ephemeral: true });
                const configService = require('../services/configService');

                const minAmount = parseInt(interaction.fields.getTextInputValue('minAmount').replace(/\D/g, '')) || 0;
                const maxAmount = parseInt(interaction.fields.getTextInputValue('maxAmount').replace(/\D/g, '')) || 999999999;
                const fee = parseInt(interaction.fields.getTextInputValue('feeAmount').replace(/\D/g, '')) || 0;
                const displayOrder = parseInt(interaction.fields.getTextInputValue('displayOrder').replace(/\D/g, '')) || 0;

                const data = { minAmount, maxAmount, fee, displayOrder, isActive: true };

                try {
                    if (customId === 'modal_mm_fee_create') {
                        await configService.createMMFee(data, interaction.user.username, interaction.user.id);
                        return interaction.editReply('✅ Fee MM baru berhasil ditambahkan.');
                    } else {
                        const feeId = customId.replace('modal_mm_fee_edit_', '');
                        await configService.updateMMFee(feeId, data, interaction.user.username, interaction.user.id);
                        return interaction.editReply('✅ Fee MM berhasil diupdate.');
                    }
                } catch (e) {
                    return interaction.editReply(`❌ Gagal menyimpan data: ${e.message}`);
                }
            }

            if (customId === 'modal_limited_order') {
                await interaction.deferReply({ ephemeral: true });

                const robloxUsername = interaction.fields.getTextInputValue('limited_username');
                const item = interaction.fields.getTextInputValue('limited_item_name');
                const rawPrice = interaction.fields.getTextInputValue('limited_price');
                const notes = interaction.fields.getTextInputValue('limited_notes');

                const price = parseInt(rawPrice.replace(/\D/g, '')) || 0;

                if (price <= 0) {
                    return interaction.editReply('❌ Harga tidak valid.');
                }

                const session = {
                    type: 'limited',
                    robloxUsername,
                    item,
                    price,
                    amount: 0,
                    notes
                };

                try {
                    await createTicketFromSession(interaction, session, interaction.client);
                } catch (error) {
                    logger.error('[Limited Item Ticket Error]', error);
                    return interaction.editReply('❌ Terjadi kesalahan saat memproses pesanan.');
                }
                return;
            }

            if (customId.startsWith('modal_mm_order_')) {
                await interaction.deferReply({ ephemeral: true });
                const feeId = customId.replace('modal_mm_order_', '');
                
                const configService = require('../services/configService');
                const fees = await configService.getMMFees();
                const feeData = fees.find(f => f._id.toString() === feeId);
                
                if (!feeData) {
                    return interaction.editReply('❌ Data Fee MM tidak ditemukan. Silakan ulangi proses pemesanan.');
                }

                const buyer = interaction.fields.getTextInputValue('mm_buyer');
                const seller = interaction.fields.getTextInputValue('mm_seller');
                const item = interaction.fields.getTextInputValue('mm_item');
                let notes = '';
                try {
                    notes = interaction.fields.getTextInputValue('mm_notes');
                } catch (e) {}

                const minStr = `Rp${feeData.minAmount.toLocaleString('id-ID')}`;
                const maxStr = feeData.maxAmount >= 999999999 ? 'Ke Atas' : `Rp${feeData.maxAmount.toLocaleString('id-ID')}`;
                const selectedRange = `${minStr} - ${maxStr}`;

                // Create session
                const session = {
                    type: 'mm_rekber',
                    amount: 0, // Not selling robux
                    price: feeData.fee, // Default to fee (will be updated if buyer inputs actual price later, but for MM, the nominal is arbitrary within the range)
                    fee: feeData.fee,
                    selectedRange,
                    buyer,
                    seller,
                    item,
                    notes,
                    robloxUsername: buyer // required field by createTicketFromSession
                };

                const confirmEmbed = new EmbedBuilder()
                    .setTitle('🔍 Konfirmasi Order MM / Rekber')
                    .setDescription('Silakan pastikan seluruh informasi transaksi sudah benar sebelum melanjutkan.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 **Informasi Transaksi**')
                    .addFields(
                        { name: 'Buyer', value: `\`${buyer}\``, inline: true },
                        { name: 'Seller', value: `\`${seller}\``, inline: true },
                        { name: 'Barang / Item', value: `\`${item}\``, inline: false },
                        { name: 'Catatan', value: `\`${notes || '-'}\``, inline: false },
                        { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '📦 **Informasi Pembayaran**', inline: false },
                        { name: 'Rentang Transaksi', value: `\`${selectedRange}\``, inline: true },
                        { name: 'Fee LyraBlox', value: `\`Rp${feeData.fee.toLocaleString('id-ID')}\``, inline: true }
                    )
                    .setFooter({ text: 'Apabila seluruh informasi sudah sesuai, silakan tekan tombol Konfirmasi Pesanan.' })
                    .setColor('#f59e0b');

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`confirm_order`).setLabel('✅ Konfirmasi Pesanan').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`cancel_order`).setLabel('✏️ Ubah Data').setStyle(ButtonStyle.Danger)
                );

                const reply = await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });

                const collector = reply.createMessageComponentCollector({
                    filter: i => i.user.id === interaction.user.id,
                    time: 300000 // 5 minutes
                });

                collector.on('collect', async i => {
                    await i.deferUpdate();
                    if (i.customId === 'cancel_order') {
                        collector.stop('cancelled');
                        return i.editReply({ content: '❌ Konfirmasi dibatalkan. Silakan ulangi proses pemesanan.', embeds: [], components: [] });
                    }
                    if (i.customId === 'confirm_order') {
                        collector.stop('confirmed');
                        return await createTicketFromSession(i, session, i.client);
                    }
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        interaction.editReply({ content: '⏳ Waktu konfirmasi habis. Silakan ulangi proses.', embeds: [], components: [] }).catch(() => {});
                    }
                });
                return;
            }

            // ==========================================
            // COPAY MODAL HANDLERS
            // ==========================================

            // Modal: copay_username_modal -> start timer immediately
            if (customId === 'copay_username_modal') {
                const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
                const discordId = interaction.user.id;

                // Anti-duplicate
                const existing = await CopayEligibility.findOne({ discordId });
                if (existing) {
                    const unixEligible = Math.floor(existing.eligibleAt.getTime() / 1000);
                    return interaction.reply({ content: `❌ Timer Eligibility Anda sudah berjalan.\n🎯 Eligible pada: <t:${unixEligible}:F> (<t:${unixEligible}:R>)` });
                }

                const now = new Date();
                const eligibleAt = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days

                const doc = new CopayEligibility({
                    discordId,
                    discordUsername: interaction.user.username,
                    robloxUsername,
                    startedAt: now,
                    eligibleAt
                });
                await doc.save();

                const unixStart = Math.floor(now.getTime() / 1000);
                const unixEligible = Math.floor(eligibleAt.getTime() / 1000);

                const timerEmbed = new EmbedBuilder()
                    .setTitle('⏳ ROBUX COMMUNITY ELIGIBILITY')
                    .setDescription(
                        `👤 **Roblox Username**\n${robloxUsername}\n\n` +
                        `📅 **Mulai Perhitungan**\n<t:${unixStart}:F> (<t:${unixStart}:R>)\n\n` +
                        `🎯 **Eligible Pada**\n<t:${unixEligible}:F> (<t:${unixEligible}:R>)\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `**Progress**\n` +
                        `Status: 🟡 Waiting\n` +
                        `Progress: 0 / 14 Hari`
                    )
                    .setColor('#f1c40f')
                    .setFooter({ text: 'Bot akan memberi tahu Anda secara otomatis ketika telah memenuhi syarat.' });

                // Reply in DM with the timer embed
                return interaction.reply({ embeds: [timerEmbed] });
            }

            // Modal: copay_modal_order -> create ticket
            if (customId.startsWith('copay_modal_order:')) {
                const packageId = customId.split(':')[1];
                const robloxUsername = interaction.fields.getTextInputValue('roblox_username');

                const pkg = await RobuxPackage.findById(packageId);
                if (!pkg) return interaction.reply({ content: 'Paket tidak ditemukan.', ephemeral: true });

                await interaction.deferReply({ ephemeral: true });
                try {
                    const session = {
                        type: 'copay',
                        amount: pkg.amount,
                        price: pkg.price,
                        robloxUsername: robloxUsername
                    };
                    await createTicketFromSession(interaction, session, interaction.client);
                    return;
                } catch (err) {
                    return interaction.editReply({ content: '❌ Gagal membuat ticket. Silakan coba lagi nanti.' });
                }
            }

            // ==========================================

            // 1. Robux Modal Order Submission (Vilog & Visend)
            
            if (customId.startsWith('vouch_modal_')) {
                const parts = customId.split('_');
                const rating = parseInt(parts[2]);
                const orderId = parts.slice(3).join('_');
                
                await interaction.deferReply({ ephemeral: true });

                const order = await Order.findOne({ orderId });
                if (!order || order.status !== 'success' || order.reviewGiven) {
                    return interaction.editReply('❌ Terjadi kesalahan atau Anda sudah pernah memberikan ulasan untuk pesanan ini.');
                }

                // Kalkulasi total harga dari seluruh pesanan di ticket yang sama (termasuk bulk orders)
                const allOrders = await Order.find({ channelId: order.channelId, status: 'success' });
                const totalPrice = allOrders.length > 0 ? allOrders.reduce((sum, o) => sum + o.price, 0) : order.price;

                let comment = interaction.fields.getTextInputValue('review_comment');
                if (!comment || comment.trim() === '') comment = 'Tidak memberikan komentar.';

                order.reviewGiven = true;
                order.rating = rating;
                order.comment = comment;
                order.reviewDate = new Date();
                await order.save();

                let stats = await ReviewStats.findOne({ id: 'global' });
                if (!stats) {
                    stats = new ReviewStats();
                }
                stats.totalReviews += 1;
                stats.stars[rating] += 1;
                
                // Recalculate average
                let totalScore = 0;
                for (let i = 1; i <= 5; i++) {
                    totalScore += (stats.stars[i] * i);
                }
                stats.averageRating = totalScore / stats.totalReviews;
                
                await stats.save();

                // Send to Vouch Channel
                const VOUCH_CHANNEL_ID = '1534629812629409952';
                const vouchChannel = await interaction.client.channels.fetch(VOUCH_CHANNEL_ID).catch(()=>null);
                
                if (vouchChannel) {
                    const starsStr = '⭐'.repeat(rating);
                    const embed = new EmbedBuilder()
                        .setTitle('⭐ LYRABLOX CUSTOMER REVIEW')
                        .setDescription('━━━━━━━━━━━━━━━━━━━━━━')
                        .addFields(
                            { name: '👤 Customer', value: `<@${order.userId}>`, inline: true },
                            { name: '⭐ Rating', value: starsStr, inline: true },
                            { name: '📦 Produk', value: order.productName, inline: true },
                            { name: '💰 Total Pembelian', value: `Rp ${totalPrice.toLocaleString('id-ID')}`, inline: true },
                            { name: '💬 Ulasan', value: comment, inline: false }
                        )
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .setFooter({ text: 'Terima kasih telah mempercayai LyraBlox ❤️' })
                        .setTimestamp();
                    
                    await vouchChannel.send({ embeds: [embed] }).catch(()=>{});
                }

                // If sent from ticket, try to disable buttons in the review panel message
                if (interaction.message && interaction.message.components) {
                    try {
                        const newRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('x1').setLabel('Review Dikirim!').setStyle(ButtonStyle.Success).setDisabled(true)
                        );
                        await interaction.message.edit({ components: [newRow] });
                    } catch(e) {}
                }

                return interaction.editReply('✅ Terima kasih! Review Anda telah berhasil dikirim.');
            }

            if (customId.startsWith('vilog_modal_order:') || customId.startsWith('visend_modal_order:') || customId === 'visend_modal_custom' || customId.startsWith('boost_modal_order:')) {
                const isVisend = customId.startsWith('visend_modal_order:') || customId === 'visend_modal_custom';
                const isCustom = customId === 'visend_modal_custom';
                const isBoost = customId.startsWith('boost_modal_order:');

                console.log(`[DEBUG] Received modal submit with customId: ${customId}. isVisend: ${isVisend}, isBoost: ${isBoost}`);

                try {
                    await interaction.deferReply({ ephemeral: true });
                } catch(e) {
                    console.error('[DEBUG] deferReply failed:', e);
                    return; // Stop execution if it's already acknowledged
                }

                try {
                    let amount, price, boostType, packageLabel;
                    
                    if (isBoost) {
                        const [, bType, pLabel, pPrice] = customId.split(':');
                        boostType = bType;
                        packageLabel = pLabel;
                        price = parseInt(pPrice);
                        amount = packageLabel;
                    } else if (isCustom) {
                        const amountStr = interaction.fields.getTextInputValue('robux_amount');
                        if (!/^\d+$/.test(amountStr) || parseInt(amountStr) <= 0) {
                            return interaction.editReply('❌ Jumlah Robux tidak valid. Harap masukkan angka saja (tanpa titik/koma) dan lebih dari 0.');
                        }
                        amount = parseInt(amountStr);
                        const rawPrice = amount * 150;
                        price = Math.ceil(rawPrice / 500) * 500;
                    } else {
                        const [, amountStr, priceStr] = customId.split(':');
                        amount = parseInt(amountStr);
                        price = parseInt(priceStr);
                    }

                    const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
                    let robloxPassword = '';
                    if (isBoost) {
                        robloxPassword = interaction.fields.getTextInputValue('roblox_password') || '';
                    } else {
                        robloxPassword = isVisend ? '' : interaction.fields.getTextInputValue('roblox_password');
                    }

                    // Validasi Roblox Username
                    const userInfo = await getRobloxUserInfo(robloxUsername);
                    if (!userInfo.success) {
                        return interaction.editReply('❌ Username Roblox tidak ditemukan.\n\nSilakan periksa kembali Username yang Anda masukkan.\nPastikan penulisan Username sudah benar.');
                    }

                    // Build Session
                    const session = {
                        type: isBoost ? `boost_${boostType}` : (isVisend ? 'visend' : 'vilog'),
                        isCustom, amount, price, packageLabel,
                        robloxUsername: userInfo.username, 
                        robloxPassword, 
                        robloxId: userInfo.id,
                        displayName: userInfo.displayName,
                        avatarUrl: userInfo.avatarUrl
                    };

                    // Order Confirmation Embed
                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('🔍 Konfirmasi Akun Roblox')
                        .setDescription('Silakan pastikan seluruh informasi akun dan pesanan sudah benar sebelum melanjutkan.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 **Informasi Akun**')
                        .addFields(
                            { name: 'Username', value: `\`${userInfo.username}\``, inline: true },
                            { name: 'Display Name', value: `\`${userInfo.displayName}\``, inline: true },
                            { name: 'User ID', value: `\`${userInfo.id}\``, inline: true },
                            { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '📦 **Informasi Pesanan**', inline: false },
                            { name: 'Produk', value: `\`${isBoost ? (boostType === 'fishit' ? 'Boost Fishit' : 'Boost Kalb') : (isVisend ? 'Robux Via Send' : 'Robux Via Login')}\``, inline: true },
                            { name: 'Paket', value: `\`${isBoost ? packageLabel : (isCustom ? 'Custom' : amount + ' Robux')}\``, inline: true },
                            { name: 'Total Pembayaran', value: `\`Rp${price.toLocaleString('id-ID')}\``, inline: true },
                            { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false }
                        )
                        .setThumbnail(userInfo.avatarUrl || 'https://tr.rbxcdn.com/default-headshot')
                        .setFooter({ text: 'Apabila seluruh informasi sudah sesuai, silakan tekan tombol Konfirmasi Pesanan.' })
                        .setColor('#ffaa00');

                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`confirm_order`).setLabel('✅ Konfirmasi Pesanan').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`cancel_order`).setLabel('✏️ Ubah Data').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setLabel('👤 Lihat Profil Roblox').setStyle(ButtonStyle.Link).setURL(`https://www.roblox.com/users/${userInfo.id}/profile`)
                    );

                    const reply = await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });

                    const collector = reply.createMessageComponentCollector({
                        filter: i => i.user.id === interaction.user.id,
                        time: 300000 // 5 minutes
                    });

                    collector.on('collect', async i => {
                        await i.deferUpdate();
                        if (i.customId === 'cancel_order') {
                            collector.stop('cancelled');
                            return i.editReply({ content: '❌ Konfirmasi dibatalkan. Silakan ulangi proses pemesanan.', embeds: [], components: [] });
                        }
                        
                        if (i.customId === 'confirm_order') {
                            collector.stop('confirmed');
                            const productName = session.type === 'gig' ? 'Gift In Game' : (session.type === 'visend' ? 'Robux Via Send' : 'Robux Via Login');
                            const activeTicket = await Ticket.findOne({ ownerId: interaction.user.id, productName, status: 'open' });
                            if (activeTicket) {
                                let activeChannel = client.channels.cache.get(activeTicket.ticketId);
                                if (!activeChannel) {
                                    try {
                                        activeChannel = await client.channels.fetch(activeTicket.ticketId);
                                    } catch (err) {
                                        activeChannel = null;
                                    }
                                }
                                if (activeChannel) {
                                    await handleBulkOrder(i, session, activeTicket);
                                } else {
                                    // Channel was deleted manually, close orphaned ticket and orders
                                    await Ticket.updateOne({ _id: activeTicket._id }, { status: 'closed' });
                                    await Order.updateMany({ channelId: activeTicket.ticketId, status: 'pending' }, { status: 'closed' });
                                    await createTicketFromSession(i, session, client);
                                }
                            } else {
                                await createTicketFromSession(i, session, client);
                            }
                        }
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            interaction.editReply({ content: '❌ Waktu konfirmasi habis. Silakan ulangi pemesanan.', embeds: [], components: [] }).catch(() => {});
                        }
                    });
                    return;
                } catch (err) {
                    logger.error('[InteractionCreate] Error submitting Robux modal:', err);
                    return interaction.editReply('❌ Gagal memproses pesanan Anda.');
                }
            }

            // 2. Gift In Game (GIG) Modal Order Submission
            if (customId === 'gig_modal_order') {
                if (interaction.replied || interaction.deferred) return;
                try {
                    await interaction.deferReply({ ephemeral: true });
                } catch (e) {
                    if (e.code === 40060 || e.code === 10062) return;
                    console.error('Error deferring GIG modal:', e);
                }

                try {
                    const gameLink = interaction.fields.getTextInputValue('gig_game_link');
                    const gamepassName = interaction.fields.getTextInputValue('gig_gamepass_name');
                    const amountStr = interaction.fields.getTextInputValue('gig_robux_amount');
                    const robloxUsername = interaction.fields.getTextInputValue('roblox_username');

                    if (!/^\d+$/.test(amountStr) || parseInt(amountStr) <= 0) {
                        return interaction.editReply('❌ Jumlah Robux tidak valid. Harap masukkan angka saja (tanpa titik/koma) dan lebih dari 0.');
                    }
                    const amount = parseInt(amountStr);
                    const configService = require('../services/configService');
                    const config = await configService.getGlobalConfig();
                    const rate = config.gigRate || 90;
                    
                    let price = amount * rate;
                    price = Math.ceil(price / 500) * 500;

                    // Validasi Roblox Username
                    const userInfo = await getRobloxUserInfo(robloxUsername);
                    if (!userInfo.success) {
                        return interaction.editReply('❌ Username Roblox tidak ditemukan.\n\nSilakan periksa kembali Username yang Anda masukkan.\nPastikan penulisan Username sudah benar.');
                    }

                    // Build Session
                    const session = {
                        type: 'gig', amount, price, rate, gameLink, gamepassName,
                        robloxUsername: userInfo.username, robloxId: userInfo.id, displayName: userInfo.displayName, avatarUrl: userInfo.avatarUrl
                    };

                    // Order Confirmation Embed for GIG
                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('🔍 Konfirmasi Akun Roblox (Gift In Game)')
                        .setDescription('Silakan pastikan seluruh informasi akun dan pesanan sudah benar sebelum melanjutkan.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 **Informasi Akun**')
                        .addFields(
                            { name: 'Username', value: `\`${userInfo.username}\``, inline: true },
                            { name: 'Display Name', value: `\`${userInfo.displayName}\``, inline: true },
                            { name: 'User ID', value: `\`${userInfo.id}\``, inline: true },
                            { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '📦 **Informasi Pesanan**', inline: false },
                            { name: 'Game / Map', value: `\`${gameLink}\``, inline: true },
                            { name: 'Gamepass', value: `\`${gamepassName}\``, inline: true },
                            { name: 'Harga Gamepass', value: `\`${amount} Robux\``, inline: true },
                            { name: 'Total Pembayaran', value: `\`Rp${price.toLocaleString('id-ID')}\``, inline: true },
                            { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '\u200b', inline: false }
                        )
                        .setThumbnail(userInfo.avatarUrl || 'https://tr.rbxcdn.com/default-headshot')
                        .setFooter({ text: 'Apabila seluruh informasi sudah sesuai, silakan tekan tombol Konfirmasi Pesanan.' })
                        .setColor('#f43f5e');

                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`confirm_order`).setLabel('✅ Konfirmasi Pesanan').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`cancel_order`).setLabel('✏️ Ubah Data').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setLabel('👤 Lihat Profil Roblox').setStyle(ButtonStyle.Link).setURL(`https://www.roblox.com/users/${userInfo.id}/profile`)
                    );

                    const reply = await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });

                    const collector = reply.createMessageComponentCollector({
                        filter: i => i.user.id === interaction.user.id,
                        time: 300000 // 5 minutes
                    });

                    collector.on('collect', async i => {
                        await i.deferUpdate();
                        if (i.customId === 'cancel_order') {
                            collector.stop('cancelled');
                            return i.editReply({ content: '❌ Konfirmasi dibatalkan. Silakan ulangi proses pemesanan.', embeds: [], components: [] });
                        }
                        
                        if (i.customId === 'confirm_order') {
                            collector.stop('confirmed');
                            const productName = session.type === 'gig' ? 'Gift In Game' : (session.type === 'visend' ? 'Robux Via Send' : 'Robux Via Login');
                            const activeTicket = await Ticket.findOne({ ownerId: interaction.user.id, productName, status: 'open' });
                            if (activeTicket) {
                                let activeChannel = client.channels.cache.get(activeTicket.ticketId);
                                if (!activeChannel) {
                                    try {
                                        activeChannel = await client.channels.fetch(activeTicket.ticketId);
                                    } catch (err) {
                                        activeChannel = null;
                                    }
                                }
                                if (activeChannel) {
                                    await handleBulkOrder(i, session, activeTicket);
                                } else {
                                    // Channel was deleted manually, close orphaned ticket and orders
                                    await Ticket.updateOne({ _id: activeTicket._id }, { status: 'closed' });
                                    await Order.updateMany({ channelId: activeTicket.ticketId, status: 'pending' }, { status: 'closed' });
                                    await createTicketFromSession(i, session, client);
                                }
                            } else {
                                await createTicketFromSession(i, session, client);
                            }
                        }
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            interaction.editReply({ content: '❌ Waktu konfirmasi habis. Silakan ulangi pemesanan.', embeds: [], components: [] }).catch(() => {});
                        }
                    });
                    return;
                } catch (err) {
                    logger.error('[InteractionCreate] Error submitting GIG modal:', err);
                    return interaction.editReply('❌ Terjadi kesalahan saat memproses pesanan.');
                }
            }
            // Roblox Verification Modal Submit
            if (customId === 'verify_modal') {
                await interaction.deferReply({ ephemeral: true });

                const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
                const discordId = interaction.user.id;

                try {
                    const verification = await verifyRobloxUsername(robloxUsername);
                    if (!verification.success) {
                        return interaction.editReply('❌ Username Roblox tidak ditemukan.');
                    }

                    const groupId = await settingsService.get('roblox_group_id', process.env.GROUP_ID);
                    if (!groupId) {
                        return interaction.editReply('❌ Sistem belum dikonfigurasi sepenuhnya (roblox_group_id belum diset). Harap hubungi Admin.');
                    }

                    const rankInGroup = await noblox.getRankInGroup(parseInt(groupId), verification.id).catch(() => 0);
                    if (rankInGroup === 0) {
                        return interaction.editReply(`❌ Akun **${verification.username}** belum bergabung ke grup Roblox kami.\nSilakan join grup terlebih dahulu, lalu verifikasi ulang.`);
                    }

                    let userRecord = await User.findOne({ discordId });
                    if (!userRecord) {
                        userRecord = await User.create({
                            discordId,
                            robloxId: verification.id,
                            robloxUsername: verification.username,
                            verified: true,
                            eligibleForPayout: false
                        });
                    } else {
                        userRecord.robloxId = verification.id;
                        userRecord.robloxUsername = verification.username;
                        userRecord.verified = true;
                    }

                    const joinedAt = userRecord.createdAt || new Date();
                    const diffTime = Math.abs(new Date() - joinedAt);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                    const isEligible = diffDays >= 14;
                    userRecord.eligibleForPayout = isEligible;
                    await userRecord.save();

                    const brandingName = await settingsService.get('branding_name', 'LyraBlox');
                    let dmMessage = `✅ **Roblox account berhasil diverifikasi sebagai ${verification.username}** (ID: ${verification.id})\n\n` +
                                    `📅 Kamu sudah terdaftar di sistem kami selama **${diffDays} hari**.\n`;

                    if (isEligible) {
                        dmMessage += `🎉 **Selamat!** Kamu sudah memenuhi syarat durasi bergabung (14 hari) untuk menerima Robux Payout.`;
                        const roleId = await settingsService.get('eligible_role_id', process.env.ELIGIBLE_ROLE_ID);
                        if (roleId) {
                            try {
                                await interaction.member.roles.add(roleId);
                            } catch (err) {
                                console.error('Failed to add role:', err);
                            }
                        }
                    } else {
                        dmMessage += `⏳ Kamu masih belum memenuhi syarat durasi bergabung 14 hari. Sisa waktu: **${14 - diffDays} hari** lagi.`;
                    }

                    // Log to payout log channel
                    const payoutChannelId = await settingsService.get('payout_log_channel_id', '1518214414254211202');
                    const payoutChannel = await client.channels.fetch(payoutChannelId).catch(() => null);
                    if (payoutChannel) {
                        const playerInfo = await noblox.getPlayerInfo(verification.id).catch(() => null);
                        if (playerInfo) {
                            const accCreatedDate = new Date(playerInfo.joinDate);
                            const accAgeDays = playerInfo.age || 0;
                            const accAgeYears = Math.floor(accAgeDays / 365);
                            const accAgeMonths = Math.floor((accAgeDays % 365) / 30);
                            const accAgeRemainingDays = (accAgeDays % 365) % 30;
                            const accAgeString = `${accAgeDays} days • ${accAgeYears > 0 ? accAgeYears + ' yr ' : ''}${accAgeMonths} mo ${accAgeRemainingDays} d`;

                            const eligibleDate = new Date();
                            eligibleDate.setDate(eligibleDate.getDate() + 14);

                            const monitorEmbed = new EmbedBuilder()
                                .setTitle(`Community Monitor • ${brandingName}`)
                                .setDescription(`${playerInfo.displayName} ( @${playerInfo.username} )\n✅ Member Joined the Community`)
                                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${verification.id}&width=420&height=420&format=png`)
                                .addFields(
                                    { name: '🆔 Username', value: `@${playerInfo.username}`, inline: true },
                                    { name: '👤 User ID', value: `${verification.id}`, inline: true },
                                    { name: '📅 Account Created', value: `<t:${Math.floor(accCreatedDate.getTime() / 1000)}:f>`, inline: true },
                                    { name: '⏳ Account Age', value: accAgeString, inline: true },
                                    { name: '📥 Join Community Date', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                                    { name: '✅ Eligible Date (+14 Days)', value: `<t:${Math.floor(eligibleDate.getTime() / 1000)}:f>`, inline: true }
                                )
                                .setFooter({ text: `${brandingName} • Join Event`, iconURL: interaction.guild.iconURL() })
                                .setColor('#2b2d31')
                                .setTimestamp();

                            const row = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`check_eligibility_${interaction.user.id}`)
                                    .setLabel('🔄 Update Status Payout')
                                    .setStyle(ButtonStyle.Primary)
                            );

                            await payoutChannel.send({ content: `<@${interaction.user.id}> telah bergabung dan diverifikasi!`, embeds: [monitorEmbed], components: [row] }).catch(() => {});
                        }
                    }

                    try {
                        await interaction.user.send(dmMessage);
                        await interaction.editReply('✅ Verifikasi berhasil diproses! Silakan cek pesan masuk (DM) Anda dari bot ini.');
                    } catch (dmError) {
                        await interaction.editReply(`✅ Verifikasi berhasil! Namun bot tidak dapat mengirimkan DM ke akun Anda (DM ditutup).\n\n${dmMessage}`);
                    }
                } catch (error) {
                    console.error('Verify error:', error);
                    await interaction.editReply('❌ Terjadi kesalahan saat memverify akun Anda.');
                }
                return;
            }

            // Dynamic Product Modal Submit
            if (customId.startsWith('submit_product_buy:')) {
                const productId = customId.replace('submit_product_buy:', '');
                await interaction.deferReply({ ephemeral: true });

                try {
                    const product = await Product.findById(productId);
                    if (!product || !product.active) {
                        return interaction.editReply('❌ Produk tidak ditemukan atau sudah tidak aktif.');
                    }

                    const details = {};
                    let qty = 1;
                    let qtyFieldId = null;

                    for (const field of product.fields) {
                        const answer = interaction.fields.getTextInputValue(field.customId);
                        details[field.label] = answer;

                        if (/quantity|amount|robux|jumlah/i.test(field.customId)) {
                            qtyFieldId = field.customId;
                            const parsedQty = parseInt(answer);
                            if (!isNaN(parsedQty) && parsedQty > 0) {
                                qty = parsedQty;
                            }
                        }
                    }

                    if (product.pricingType === 'PER_ROBUX') {
                        if (!qtyFieldId) {
                            return interaction.editReply('❌ Konfigurasi modal salah: Tidak ada input field untuk jumlah Robux.');
                        }
                        const answer = interaction.fields.getTextInputValue(qtyFieldId);
                        const parsedQty = parseInt(answer);
                        if (isNaN(parsedQty) || parsedQty <= 0) {
                            return interaction.editReply('❌ Jumlah pembelian Robux harus berupa angka yang valid.');
                        }
                        qty = parsedQty;
                    }

                    let subtotal = 0;
                    let rounding = 0;
                    let totalPay = 0;

                    if (product.pricingType === 'PER_ROBUX') {
                        subtotal = qty * product.price;
                        totalPay = Math.ceil(subtotal / 500) * 500;
                        rounding = totalPay - subtotal;
                    } else {
                        if (qtyFieldId) {
                            subtotal = qty * product.price;
                            totalPay = subtotal;
                        } else {
                            subtotal = product.price;
                            totalPay = subtotal;
                        }
                        rounding = 0;
                    }

                    const totalOrders = await Order.countDocuments();
                    const orderId = `LB-${String(totalOrders + 1).padStart(6, '0')}`;

                    let categoryId = product.categoryId;
                    if (!categoryId) {
                        categoryId = await settingsService.get('global_ticket_category_id');
                    }
                    
                    const ticketCategory = categoryId ? await interaction.guild.channels.fetch(categoryId).catch(() => null) : null;

                    const staffRoleId = await settingsService.get('staff_role_id');
                    const adminRoleId = await settingsService.get('admin_role_id');
                    const ownerRoleId = await settingsService.get('owner_role_id');

                    const permissions = [
                        { id: interaction.guild.id, deny: ['ViewChannel'] },
                        { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                        { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] }
                    ];

                    const targetStaffRole = product.staffRoleId || staffRoleId;
                    if (targetStaffRole) {
                        permissions.push({ id: targetStaffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
                    }
                    if (adminRoleId && adminRoleId !== targetStaffRole) {
                        permissions.push({ id: adminRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
                    }
                    if (ownerRoleId && ownerRoleId !== targetStaffRole && ownerRoleId !== adminRoleId) {
                        permissions.push({ id: ownerRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
                    }

                    const channelName = `buy-${product.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${interaction.user.username}`;
                    const channel = await interaction.guild.channels.create({
                        name: channelName,
                        type: 0,
                        parent: ticketCategory ? ticketCategory.id : null,
                        permissionOverwrites: permissions
                    });

                    await Order.create({
                        orderId,
                        userId: interaction.user.id,
                        productName: product.pricingType === 'PER_ROBUX' ? `${product.name} (x${qty})` : product.name,
                        price: totalPay,
                        subtotal,
                        rounding,
                        status: 'pending',
                        channelId: channel.id,
                        details,
                        snapshot: {
                            productType: product.name,
                            productName: product.name,
                            amount: qty,
                            price: product.price,
                            rate: null,
                            timestamp: Date.now()
                        }
                    });

                    await Ticket.create({
                        ticketId: channel.id,
                        ownerId: interaction.user.id,
                        productId: product._id,
                        productName: product.name,
                        orderId,
                        status: 'open'
                    });

                    // Update Voice Status
                    const voiceStatusService = require('../services/voiceStatusService');
                    voiceStatusService.updateAllVoiceStatuses(interaction.client);
                    const brandingName = await settingsService.get('branding_name', 'LyraBlox');
                    const title = product.embed.title || `Beli ${product.name}`;
                    const description = product.embed.description || `Halo ${interaction.user}, terima kasih telah memesan produk ini!`;
                    const color = product.embed.color || '#0099ff';
                    const thumbnail = product.embed.thumbnail;
                    const banner = product.embed.banner;
                    const footer = product.embed.footer || `${brandingName} Store`;

                    const ticketEmbed = new EmbedBuilder()
                        .setTitle(title)
                        .setDescription(description)
                        .setColor(color)
                        .setFooter({ text: footer })
                        .setTimestamp();

                    if (thumbnail) ticketEmbed.setThumbnail(thumbnail);
                    if (banner) ticketEmbed.setImage(banner);

                    let modalResponsesStr = '';
                    for (const [label, answer] of Object.entries(details)) {
                        modalResponsesStr += `• **${label}:** ${answer}\n`;
                    }
                    ticketEmbed.addFields({ name: '📋 Data Formulir:', value: modalResponsesStr || 'Tidak ada data formulir.' });

                    let priceBreakdownStr = '';
                    if (product.pricingType === 'PER_ROBUX') {
                        priceBreakdownStr = `• **Robux:** ${qty.toLocaleString('id-ID')}\n` +
                                            `• **Harga / Robux:** Rp ${product.price.toLocaleString('id-ID')}\n` +
                                            `• **Subtotal:** Rp ${subtotal.toLocaleString('id-ID')}\n` +
                                            `• **Pembulatan:** +Rp ${rounding.toLocaleString('id-ID')}\n` +
                                            `━━━━━━━━━━━━━━━━━━━━━━\n` +
                                            `• **Total Bayar:** **Rp ${totalPay.toLocaleString('id-ID')}**`;
                    } else {
                        if (qtyFieldId) {
                            priceBreakdownStr = `• **Jumlah:** ${qty}\n` +
                                                `• **Harga Satuan:** Rp ${product.price.toLocaleString('id-ID')}\n` +
                                                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                                                `• **Total Bayar:** **Rp ${totalPay.toLocaleString('id-ID')}**`;
                        } else {
                            priceBreakdownStr = `• **Total Bayar:** **Rp ${totalPay.toLocaleString('id-ID')}**`;
                        }
                    }

                    ticketEmbed.addFields({ name: '💵 Rincian Pembayaran:', value: priceBreakdownStr });

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`order_deliver_${orderId}`).setLabel('Mark Delivered').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`order_cancel_${orderId}`).setLabel('Cancel Order').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                    );

                    const staffMention = targetStaffRole ? `<@&${targetStaffRole}>` : '';
                    const adminMention = adminRoleId ? `<@&${adminRoleId}>` : '';
                    await channel.send({ content: `${interaction.user} | ${staffMention} ${adminMention}`, embeds: [ticketEmbed], components: [row] });

                    await interaction.editReply(`✅ Tiket pesanan berhasil dibuat! Silakan masuk ke: ${channel}`);
                } catch (err) {
                    logger.error('[InteractionCreate] Error submitting dynamic buy modal:', err);
                    return interaction.editReply('❌ Terjadi kesalahan saat memproses pesanan Anda.');
                }
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_inventory_management') {
                const gigStockStr = interaction.fields.getTextInputValue('input_gig_stock');
                const sendStockStr = interaction.fields.getTextInputValue('input_send_stock');

                const gigStock = parseInt(gigStockStr.replace(/[^0-9]/g, '')) || 0;
                const sendStock = parseInt(sendStockStr.replace(/[^0-9]/g, '')) || 0;

                const configService = require('../services/configService');
                
                try {
                    await configService.updateInventory('GIG', gigStock, interaction.user.username, interaction.user.id);
                    await configService.updateInventory('SEND', sendStock, interaction.user.username, interaction.user.id);
                    
                    // Force Voice Sync immediately for responsiveness
                    const voiceStatusService = require('../services/voiceStatusService');
                    voiceStatusService.updateAllVoiceStatuses(interaction.client);
                    
                    // Refresh Dashboard message
                    const { buildDashboardMessage } = require('../services/storeService');
                    const newDashboard = await buildDashboardMessage(interaction.client);
                    
                    // We need to fetch the original message to edit it, or just use interaction.update() if we clicked the button
                    // Wait, this is a modal submit from the button. So update() edits the message where the button was.
                    await interaction.update({ embeds: newDashboard.embeds, components: newDashboard.components });
                } catch (err) {
                    logger.error('[Dashboard] Error updating inventory:', err);
                    await interaction.reply({ content: '❌ Terjadi kesalahan saat menyimpan Inventory.', ephemeral: true });
                }
            } else if (interaction.customId === 'modal_gig_config') {
                const gigRateStr = interaction.fields.getTextInputValue('input_gig_rate');
                const gigRate = parseInt(gigRateStr.replace(/[^0-9]/g, ''));
                
                if (isNaN(gigRate) || gigRate <= 0) {
                    return interaction.reply({ content: '❌ GIG Rate tidak valid. Harap masukkan angka yang benar (contoh: 90).', ephemeral: true });
                }

                const configService = require('../services/configService');
                
                try {
                    await configService.updateGlobalRate(gigRate, interaction.user.username, interaction.user.id);
                    
                    // Force Voice Sync immediately for responsiveness
                    const voiceStatusService = require('../services/voiceStatusService');
                    voiceStatusService.updateAllVoiceStatuses(interaction.client);
                    
                    // Refresh Dashboard message
                    const { buildDashboardMessage } = require('../services/storeService');
                    const newDashboard = await buildDashboardMessage(interaction.client);
                    
                    // Sync GIG Panel
                    const robuxService = require('../services/robuxService');
                    await robuxService.syncGigPanel(interaction.client);

                    await interaction.update({ embeds: newDashboard.embeds, components: newDashboard.components });
                } catch (err) {
                    logger.error('[Dashboard] Error updating GIG Rate:', err);
                    await interaction.reply({ content: '❌ Terjadi kesalahan saat menyimpan GIG Rate.', ephemeral: true });
                }
            } else if (interaction.customId === 'modal_product_management') {
                await interaction.deferReply({ ephemeral: true });
                const rawPackages = interaction.fields.getTextInputValue('input_packages');
                const productType = interaction.fields.getTextInputValue('input_product_type'); // We use a hidden-like text input for type

                const lines = rawPackages.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                const newPackages = [];
                let order = 1;
                for (const line of lines) {
                    // Expecting format: Robux=Price or Robux:Price or Robux-Price
                    const parts = line.split(/[=:\-]/);
                    if (parts.length === 2) {
                        const amount = parseInt(parts[0].replace(/[^0-9]/g, ''));
                        const price = parseInt(parts[1].replace(/[^0-9]/g, ''));
                        if (!isNaN(amount) && !isNaN(price)) {
                            newPackages.push({ type: productType, amount, price, displayOrder: order++, isActive: true });
                        }
                    }
                }

                if (newPackages.length === 0) {
                    return interaction.editReply({ content: '❌ Format paket tidak valid. Gunakan format: Robux=Harga\nContoh:\n80=16000\n160=32000' });
                }

                const configService = require('../services/configService');
                const RobuxPackage = require('../models/RobuxPackage');

                try {
                    const normalizedType = configService.normalizeProductType ? configService.normalizeProductType(productType) : productType.toLowerCase();

                    await RobuxPackage.updateMany({ type: normalizedType }, { isActive: false });
                    
                    for (const pkgData of newPackages) {
                        await configService.createProductPackage(normalizedType, pkgData, interaction.user.username, interaction.user.id);
                    }

                    const robuxService = require('../services/robuxService');
                    if (robuxService.refreshProductPanel) {
                        await robuxService.refreshProductPanel(interaction.client, normalizedType);
                    } else {
                        if (normalizedType === 'vilog') await robuxService.syncVilogPanel(interaction.client);
                        if (normalizedType === 'visend') await robuxService.syncVisendPanel(interaction.client);
                    }
                    
                    await interaction.editReply({ content: `✅ Pricelist untuk ${productType} berhasil diperbarui!` });
                } catch (err) {
                    logger.error(`[Dashboard] Error updating product packages for ${productType}:`, err);
                    await interaction.editReply({ content: '❌ Terjadi kesalahan saat memperbarui Pricelist.' });
                }
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'dashboard_select_product_type') {
                const productType = interaction.values[0];
                const configService = require('../services/configService');
                
                // Fetch existing active packages to pre-fill the modal
                const packages = await configService.getProductPackages(productType);
                let currentText = packages.map(p => `${p.amount}=${p.price}`).join('\n');
                if (!currentText) currentText = '80=16000\n160=32000';

                const modal = new ModalBuilder()
                    .setCustomId('modal_product_management')
                    .setTitle(`Kelola Pricelist: ${productType}`);

                const typeInput = new TextInputBuilder()
                    .setCustomId('input_product_type')
                    .setLabel('Product Type (JANGAN DIUBAH)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(productType)
                    .setRequired(true);

                const packagesInput = new TextInputBuilder()
                    .setCustomId('input_packages')
                    .setLabel('Format: Robux=Harga (Satu per baris)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(currentText)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(typeInput),
                    new ActionRowBuilder().addComponents(packagesInput)
                );

                return await interaction.showModal(modal);
            }
        }
        } catch (error) {
            console.error('[Interaction Error] Unhandled interaction error:', error);
            const replyOpts = { content: '❌ Terjadi kesalahan sistem saat memproses permintaan Anda.', ephemeral: true };
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply(replyOpts).catch(() => {});
                } else if (interaction.deferred) {
                    await interaction.editReply(replyOpts).catch(() => {});
                } else {
                    await interaction.followUp(replyOpts).catch(() => {});
                }
            } catch (e) {}
        }
    }
};
