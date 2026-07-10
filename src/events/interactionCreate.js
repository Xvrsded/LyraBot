const { Events } = require('discord.js');
const interactionRouter = require('../handlers/interactionRouter');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // 1. Enterprise Discord UI Framework Router
        const uiRouter = require('../modules/ui/utils/router');
        const isUI = await uiRouter.handleInteraction(interaction);
        if (isUI) return;

        // 2. Centralized Interaction Router (Legacy/Module components)
        const handled = await interactionRouter.handle(interaction);
        if (handled) return;

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
        } else if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command && typeof command.autocomplete === 'function') {
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    console.error('Autocomplete Execution Error:', error);
                }
            }
            return;
        }

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            const startTime = Date.now();
            try {
                await command.execute(interaction);
                const latency = Date.now() - startTime;
                const metricsService = require('../services/metricsService');
                metricsService.recordCommand(interaction.commandName, latency);
            } catch (error) {
                console.error('Command Execution Error:', error);
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'Terdapat kesalahan saat mengeksekusi command ini!', ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'Terdapat kesalahan saat mengeksekusi command ini!', ephemeral: true });
                    }
                } catch (replyError) {
                    console.error('Failed to send error message:', replyError);
                }
            }
        } else if (interaction.isButton()) {
            const { customId } = interaction;
            
            // Handle verify button
            if (customId === 'verify_btn') {
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                
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

                const firstActionRow = new ActionRowBuilder().addComponents(usernameInput);
                modal.addComponents(firstActionRow);

                return await interaction.showModal(modal);
            }

            try {
                const staffRoles = ['1505190278003298324', '1517049069166526546'];
                const restrictedButtons = ['ticket_close', 'staff_delivered', 'staff_cancel', 'staff_delivered_product', 'staff_cancel_product'];
                if (restrictedButtons.includes(customId)) {
                    const hasRole = staffRoles.some(roleId => interaction.member.roles.cache.has(roleId));
                    if (!hasRole) {
                        return interaction.reply({ content: '❌ Anda tidak memiliki izin untuk melakukan tindakan ini.', ephemeral: true });
                    }
                }

                if (customId.startsWith('ticket_') && customId !== 'ticket_close') {
                    const category = customId.split('_')[1];
                    const Ticket = require('../models/Ticket');
                    
                    await interaction.deferReply({ ephemeral: true });

                    const ticketId = `ticket-${interaction.user.id.slice(-4)}-${Date.now().toString().slice(-4)}`;
                    
                    const channel = await interaction.guild.channels.create({
                        name: `${category}-${interaction.user.username}`,
                        type: 0, // GuildText
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: ['ViewChannel'],
                            },
                            {
                                id: interaction.user.id,
                                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                            },
                            {
                                id: interaction.client.user.id,
                                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'],
                            },
                            {
                                id: '1505190278003298324', // Owner
                                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                            },
                            {
                                id: '1517049069166526546', // Admin
                                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                            }
                        ],
                    });

                    await Ticket.create({
                        ticketId: channel.id,
                        ownerId: interaction.user.id,
                        category: category
                    });

                    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                    const embed = new EmbedBuilder()
                        .setTitle(`Ticket: ${category.toUpperCase()}`)
                        .setDescription(`Halo ${interaction.user}, staf kami akan segera membantu Anda. Silakan jelaskan keperluan Anda.`)
                        .setColor('#00ff00');

                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('ticket_close')
                                .setLabel('Close Ticket')
                                .setStyle(ButtonStyle.Danger)
                        );

                    await channel.send({ content: `${interaction.user} | <@&1505190278003298324> <@&1517049069166526546>`, embeds: [embed], components: [row] });
                    await interaction.editReply(`✅ Tiket berhasil dibuat: ${channel}`);
                } else if (customId === 'ticket_close') {
                    const Ticket = require('../models/Ticket');
                    await interaction.deferReply();
                    
                    await Ticket.findOneAndUpdate(
                        { ticketId: interaction.channel.id },
                        { status: 'closed' }
                    );

                    await interaction.editReply('Tiket ini akan ditutup dalam 5 detik...');
                    setTimeout(() => {
                        interaction.channel.delete().catch(console.error);
                    }, 5000);
                } else if (customId === 'staff_delivered') {
                    const Order = require('../models/Order');
                    const Ticket = require('../models/Ticket');
                    
                    await interaction.deferReply();
                    
                    const order = await Order.findOne({ channelId: interaction.channel.id });
                    if (!order) {
                        return interaction.editReply('❌ Data pesanan tidak ditemukan untuk channel ini.');
                    }
                    
                    // 1. Update order status
                    order.status = 'delivered';
                    await order.save();

                    try {
                        const { triggerLeaderboardUpdate } = require('../scripts/update_leaderboard');
                        triggerLeaderboardUpdate();
                    } catch (e) {
                        console.error('Failed to trigger leaderboard update:', e);
                    }
                    
                    // 2. Update Embed Ticket
                    const message = interaction.message;
                    if (message && message.embeds && message.embeds.length > 0) {
                        const { EmbedBuilder } = require('discord.js');
                        const oldEmbed = message.embeds[0];
                        const newEmbed = EmbedBuilder.from(oldEmbed)
                            .setDescription(oldEmbed.description.replace('🟡 Pending', '🟢 Delivered'))
                            .setColor('#00ff00');
                        await message.edit({ embeds: [newEmbed] }).catch(console.error);
                    }
                    
                    // 4. Kirim DM ke customer
                    try {
                        const customer = await interaction.client.users.fetch(order.userId);
                        if (customer) {
                            const dmMessage = `🎉 Pesanan Robux Anda telah berhasil diproses!\n\n📦 Order ID: ${order.orderId}\n🎮 Username Roblox: ${order.robloxUsername}\n💰 Jumlah Robux: ${order.robuxAmount}\n💵 Total Pembayaran: Rp ${order.price.toLocaleString('id-ID')}\n\nTerima kasih telah mempercayai WinterStore.\nKami berharap dapat melayani Anda kembali.\n\n❄️ WinterStore Team`;
                            await customer.send(dmMessage);
                        }
                    } catch (e) {
                        console.error('Failed to DM user:', e);
                    }
                    
                    // 5. Kirim embed BARU ke channel log
                    try {
                        const logChannel = await interaction.client.channels.fetch('1517637984705319033');
                        if (logChannel) {
                            const { EmbedBuilder } = require('discord.js');
                            const logEmbed = new EmbedBuilder()
                                .setTitle('✅ Robux Delivery Completed')
                                .setDescription('Pesanan pelanggan telah berhasil diselesaikan dan dikirim.')
                                .addFields(
                                    { name: '📦 Order Information\nOrder ID:', value: order.orderId, inline: false },
                                    { name: '👤 Customer', value: `<@${order.userId}>`, inline: true },
                                    { name: '🎮 Roblox Username', value: order.robloxUsername, inline: true },
                                    { name: '💰 Robux Delivered', value: `${order.robuxAmount} Robux`, inline: false },
                                    { name: '💵 Total Payment', value: `Rp ${order.price.toLocaleString('id-ID')}`, inline: true },
                                    { name: '👨💼 Processed By', value: `<@${interaction.user.id}>`, inline: true },
                                    { name: '🕒 Delivery Time', value: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB', inline: false }
                                )
                                .setFooter({ text: 'WinterStore Delivery Logs' })
                                .setColor('#00ff00');
                                
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    } catch (e) {
                        console.error('Failed to send log:', e);
                    }
                    
                    // Auto close logic
                    await interaction.editReply('✅ Pesanan telah selesai diproses.\n\nTicket akan ditutup otomatis dalam 60 detik.');
                    
                    await Ticket.findOneAndUpdate({ ticketId: interaction.channel.id }, { status: 'closed' });
                    
                    setTimeout(() => {
                        interaction.channel.delete().catch(console.error);
                    }, 60000);
                    
                } else if (customId === 'staff_delivered_product') {
                    const ProductOrder = require('../models/ProductOrder');
                    const Ticket = require('../models/Ticket');
                    
                    await interaction.deferReply();
                    
                    const order = await ProductOrder.findOne({ channelId: interaction.channel.id });
                    if (!order) {
                        return interaction.editReply('❌ Data pesanan produk tidak ditemukan untuk channel ini.');
                    }
                    
                    order.status = 'delivered';
                    await order.save();

                    try {
                        const { triggerLeaderboardUpdate } = require('../scripts/update_leaderboard');
                        triggerLeaderboardUpdate();
                    } catch (e) {
                        console.error('Failed to trigger leaderboard update:', e);
                    }
                    
                    const message = interaction.message;
                    if (message && message.embeds && message.embeds.length > 0) {
                        const { EmbedBuilder } = require('discord.js');
                        const oldEmbed = message.embeds[0];
                        const newEmbed = EmbedBuilder.from(oldEmbed)
                            .setDescription(oldEmbed.description.replace('🟡 Pending', '🟢 Delivered'))
                            .setColor('#00ff00');
                        await message.edit({ embeds: [newEmbed] }).catch(console.error);
                    }
                    
                    try {
                        const logChannel = await interaction.client.channels.fetch('1517960763698843779');
                        if (logChannel) {
                            const { EmbedBuilder } = require('discord.js');
                            const logEmbed = new EmbedBuilder()
                                .setTitle('✅ Product Delivery Completed')
                                .setDescription('Pesanan produk telah berhasil diselesaikan dan dikirim.')
                                .addFields(
                                    { name: '📦 Order ID', value: order.orderId, inline: false },
                                    { name: '👤 Customer', value: `<@${order.userId}>`, inline: true },
                                    { name: '🛍️ Product', value: order.productName, inline: true },
                                    { name: '💵 Total Payment', value: `Rp ${order.price.toLocaleString('id-ID')}`, inline: true },
                                    { name: '👨💼 Processed By', value: `<@${interaction.user.id}>`, inline: true },
                                    { name: '🕒 Delivery Time', value: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB', inline: false }
                                )
                                .setFooter({ text: 'WinterStore Product Logs' })
                                .setColor('#00ff00');
                                
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    } catch (e) {
                        console.error('Failed to send product log:', e);
                    }
                    
                    await interaction.editReply('✅ Pesanan produk telah selesai diproses.\n\nTicket akan ditutup otomatis dalam 60 detik.');
                    await Ticket.findOneAndUpdate({ ticketId: interaction.channel.id }, { status: 'closed' });
                    
                    setTimeout(() => {
                        interaction.channel.delete().catch(console.error);
                    }, 60000);
                    
                } else if (customId === 'staff_cancel') {
                    const Order = require('../models/Order');
                    const Ticket = require('../models/Ticket');
                    
                    await interaction.deferReply();
                    
                    const order = await Order.findOne({ channelId: interaction.channel.id });
                    if (order) {
                        order.status = 'cancelled';
                        await order.save();
                    }
                    
                    const message = interaction.message;
                    if (message && message.embeds && message.embeds.length > 0) {
                        const { EmbedBuilder } = require('discord.js');
                        const oldEmbed = message.embeds[0];
                        const newEmbed = EmbedBuilder.from(oldEmbed)
                            .setDescription(oldEmbed.description.replace('🟡 Pending', '🔴 Cancelled'))
                            .setColor('#ff0000');
                        await message.edit({ embeds: [newEmbed] }).catch(console.error);
                    }
                    
                    await interaction.editReply('❌ Pesanan telah dibatalkan.\n\nTicket akan ditutup otomatis dalam 10 detik.');
                    await Ticket.findOneAndUpdate({ ticketId: interaction.channel.id }, { status: 'closed' });
                    
                    setTimeout(() => {
                        interaction.channel.delete().catch(console.error);
                    }, 10000);
                } else if (customId === 'staff_cancel_product') {
                    const ProductOrder = require('../models/ProductOrder');
                    const Ticket = require('../models/Ticket');
                    const Product = require('../models/Product');
                    const { updateProductEmbed } = require('../services/productService');
                    
                    await interaction.deferReply();
                    
                    const order = await ProductOrder.findOne({ channelId: interaction.channel.id });
                    if (order) {
                        order.status = 'cancelled';
                        await order.save();
                        
                        const product = await Product.findOne({ name: order.productName });
                        if (product) {
                            product.stock += 1;
                            await product.save();
                            await updateProductEmbed(interaction.client, interaction.guild.id);
                        }
                    }
                    
                    const message = interaction.message;
                    if (message && message.embeds && message.embeds.length > 0) {
                        const { EmbedBuilder } = require('discord.js');
                        const oldEmbed = message.embeds[0];
                        const newEmbed = EmbedBuilder.from(oldEmbed)
                            .setDescription(oldEmbed.description.replace('🟡 Pending', '🔴 Cancelled'))
                            .setColor('#ff0000');
                        await message.edit({ embeds: [newEmbed] }).catch(console.error);
                    }
                    
                    await interaction.editReply('❌ Pesanan produk telah dibatalkan dan stok telah dikembalikan.\n\nTicket akan ditutup otomatis dalam 10 detik.');
                    await Ticket.findOneAndUpdate({ ticketId: interaction.channel.id }, { status: 'closed' });
                    
                    setTimeout(() => {
                        interaction.channel.delete().catch(console.error);
                    }, 10000);
                } else if (customId.startsWith('check_eligibility_')) {
                    await interaction.deferReply({ ephemeral: true });
                    const targetDiscordId = customId.replace('check_eligibility_', '');
                    
                    const User = require('../models/User');
                    const dbUser = await User.findOne({ discordId: targetDiscordId });
                    
                    if (!dbUser) {
                        return interaction.editReply('❌ Data user tidak ditemukan di database.');
                    }
                    
                    const groupId = process.env.GROUP_ID;
                    if (groupId && dbUser.robloxId) {
                        try {
                            const noblox = require('noblox.js');
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
                    
                    const roleId = process.env.ELIGIBLE_ROLE_ID;
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
                        
                        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
                            
                            await interaction.message.edit({ embeds: [embed], components: [row] }).catch(console.error);
                        }
                        
                        return interaction.editReply('🎉 Sukses! Akun telah terverifikasi sebagai **Eligible** dan role telah diberikan.');
                    } else {
                        return interaction.editReply(`⏳ Akun belum memenuhi syarat durasi server (butuh 14 hari).\n\n• Roblox: **@${dbUser.robloxUsername}**\n• Durasi bergabung: **${diffDays} hari**\n• Sisa waktu: **${14 - diffDays} hari** lagi.`);
                    }
                } else if (customId === 'admin_clone_server') {
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const modal = new ModalBuilder()
                        .setCustomId('admin_clone_modal')
                        .setTitle('Sync / Clone Server');
                    const targetInput = new TextInputBuilder()
                        .setCustomId('target_guild_id')
                        .setLabel('Target Guild ID (ID Server Baru)')
                        .setPlaceholder('Masukkan ID server baru tempat menyalin...')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(15)
                        .setMaxLength(25);
                    modal.addComponents(new ActionRowBuilder().addComponents(targetInput));
                    return await interaction.showModal(modal);
                } else if (customId === 'admin_wipe_server') {
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const modal = new ModalBuilder()
                        .setCustomId('admin_wipe_modal')
                        .setTitle('Wipe Server Target');
                    const targetInput = new TextInputBuilder()
                        .setCustomId('target_guild_id')
                        .setLabel('Target Guild ID')
                        .setPlaceholder('Masukkan ID server target yang akan dibersihkan...')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(15)
                        .setMaxLength(25);
                    const confirmInput = new TextInputBuilder()
                        .setCustomId('confirm_wipe')
                        .setLabel('Ketik "WIPE" untuk mengonfirmasi')
                        .setPlaceholder('WIPE')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(4)
                        .setMaxLength(4);
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(targetInput),
                        new ActionRowBuilder().addComponents(confirmInput)
                    );
                    return await interaction.showModal(modal);
                } else if (customId === 'admin_autogen_server') {
                    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('admin_select_template')
                        .setPlaceholder('Pilih template server yang ingin di-generate...')
                        .addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Roblox Store')
                                .setDescription('Template server toko Robux (sama seperti server ini)')
                                .setValue('roblox_store')
                                .setEmoji('💎'),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('OwO Bot Server')
                                .setDescription('Template server khusus bot OwO (grind, media, chat)')
                                .setValue('owo_bot')
                                .setEmoji('🤖')
                        );
                    const row = new ActionRowBuilder().addComponents(select);
                    await interaction.reply({ content: 'Pilih salah satu template server di bawah ini untuk di-generate secara otomatis:', components: [row], ephemeral: true });
                } else if (customId === 'admin_layout_update') {
                    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('admin_select_layout')
                        .setPlaceholder('Pilih Aesthetic Layout...')
                        .addOptions(
                            new StringSelectMenuOptionBuilder().setLabel('Gamer / Tech').setDescription('⚡ [CATEGORY] | >_ channel-name').setValue('gamer').setEmoji('⚡'),
                            new StringSelectMenuOptionBuilder().setLabel('Elegant Diamond').setDescription('✦・[CATEGORY] | ❖ channel-name ❖').setValue('diamond').setEmoji('💎'),
                            new StringSelectMenuOptionBuilder().setLabel('Royal Fantasy').setDescription('✦ [CATEGORY] ✦ | ⧼ channel-name ⧽').setValue('royal').setEmoji('👑'),
                            new StringSelectMenuOptionBuilder().setLabel('Connected Nodes').setDescription('🌸 [CATEGORY] | ⑆ channel-name ⑆').setValue('nodes').setEmoji('🌸'),
                            new StringSelectMenuOptionBuilder().setLabel('Tree Branch').setDescription('✦・[CATEGORY] | ┣・channel-name').setValue('branch').setEmoji('🌿'),
                            new StringSelectMenuOptionBuilder().setLabel('Undo / Restore Default').setDescription('Mengembalikan layout ke emote dan titik dasar.').setValue('restore').setEmoji('↩️')
                        );
                    const row = new ActionRowBuilder().addComponents(select);
                    await interaction.reply({ content: '**🎨 Server Layout Manager**\nPilih style layout yang ingin diterapkan pada seluruh channel dan kategori di server ini.', components: [row], ephemeral: true });
                } else if (customId === 'admin_resend_panels') {
                    await interaction.deferReply({ ephemeral: true });
                    const { updateStoreEmbed } = require('../services/storeService');
                    const { updateProductEmbed } = require('../services/productService');
                    const { ActionRowBuilder } = require('discord.js');
                    await updateStoreEmbed(interaction.client);
                    await updateProductEmbed(interaction.client, interaction.guild.id);
                    
                    const verifyChannel = interaction.guild.channels.cache.find(c => c.type === 0 && (c.name.includes('verify') || c.name.includes('verif') || c.name.includes('konfirmasi')));
                    if (verifyChannel) {
                        const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                        const embed = new EmbedBuilder()
                            .setTitle('🔐 Verifikasi Akun Roblox')
                            .setDescription('Silakan klik tombol di bawah ini untuk memverifikasi akun Roblox Anda dan mengecek kelayakan Payout.\n\n**Syarat Payout:**\n1. Harus tergabung di Community Roblox kami.\n2. Harus sudah berada di Community Roblox kami selama minimal 14 Hari (Server Discord ini hanya untuk antrean / order Robux).')
                            .setColor('#0099ff');
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('verify_btn').setLabel('Verifikasi Sekarang').setStyle(ButtonStyle.Success).setEmoji('🔗')
                        );
                        await verifyChannel.send({ embeds: [embed], components: [row] }).catch(console.error);
                    }
                    const ticketChannel = interaction.guild.channels.cache.find(c => c.type === 0 && (c.name.includes('ticket') || c.name.includes('support') || c.name.includes('bantuan')));
                    if (ticketChannel) {
                        const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                        const embed = new EmbedBuilder()
                            .setColor('#0099ff')
                            .setTitle('WinterBot Support')
                            .setDescription('Silakan klik tombol di bawah ini untuk membuat tiket baru sesuai kebutuhan Anda.');
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('ticket_support').setLabel('Support').setEmoji('🎫').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('ticket_order').setLabel('Order').setEmoji('🛒').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('ticket_ugc').setLabel('Custom UGC').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('ticket_report').setLabel('Report').setEmoji('🐛').setStyle(ButtonStyle.Danger)
                        );
                        await ticketChannel.send({ embeds: [embed], components: [row] }).catch(console.error);
                    }
                    await interaction.editReply('✅ Panel-panel berhasil dikirim ulang ke channel masing-masing!');
                } else if (customId === 'store_refresh') {
                    await interaction.deferReply({ ephemeral: true });
                    const StoreConfig = require('../models/StoreConfig');
                    const config = await StoreConfig.findOne({ guildId: interaction.guild.id });
                    if (config) {
                        config.lastAvailable = null;
                        config.lastPending = null;
                        await config.save();
                    }
                    const { updateStoreEmbed } = require('../services/storeService');
                    await updateStoreEmbed(interaction.client);
                    await interaction.editReply('✅ Stock berhasil direfresh!');
                } else if (customId === 'store_packages') {
                    await interaction.deferReply({ ephemeral: true });
                    const StoreConfig = require('../models/StoreConfig');
                    const config = await StoreConfig.findOne({ guildId: interaction.guild.id });
                    if (!config || config.packages.length === 0) {
                        return interaction.editReply('Belum ada paket yang tersedia.');
                    }
                    const sortedPackages = [...config.packages].sort((a, b) => a.amount - b.amount);
                    let packageList = '📋 **Daftar Paket Robux**\n\n';
                    sortedPackages.forEach(pkg => {
                        packageList += `🔹 **${pkg.amount} Robux** = Rp ${pkg.price.toLocaleString('id-ID')}\n`;
                    });
                    await interaction.editReply(packageList);
                } else if (customId === 'store_order') {
                    const StoreConfig = require('../models/StoreConfig');
                    const config = await StoreConfig.findOne({ guildId: interaction.guild.id });
                    
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
                    
                    if (!config || config.packages.length === 0) {
                        const modal = new ModalBuilder()
                            .setCustomId('store_order_modal')
                            .setTitle('Order Robux Manual');
                            
                        const robuxInput = new TextInputBuilder()
                            .setCustomId('robux_amount')
                            .setLabel('Jumlah Robux')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);
                            
                        const usernameInput = new TextInputBuilder()
                            .setCustomId('roblox_username')
                            .setLabel('Username Roblox')
                            .setPlaceholder('Pastikan benar! Kesalahan username bukan tanggung jawab admin.')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);
                            
                        modal.addComponents(new ActionRowBuilder().addComponents(robuxInput), new ActionRowBuilder().addComponents(usernameInput));
                        return interaction.showModal(modal);
                    }
                    
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('store_order_select')
                        .setPlaceholder('Pilih paket Robux yang ingin dibeli');
                        
                    const sortedPackages = [...config.packages].sort((a, b) => a.amount - b.amount);
                    sortedPackages.forEach(pkg => {
                        select.addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(`${pkg.amount} Robux`)
                                .setDescription(`Harga: Rp ${pkg.price.toLocaleString('id-ID')}`)
                                .setValue(pkg.amount.toString())
                        );
                    });
                    
                    select.addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Input Manual')
                            .setDescription('Masukkan jumlah Robux secara manual')
                            .setValue('manual')
                    );
                    
                    const row = new ActionRowBuilder().addComponents(select);
                    await interaction.reply({ content: 'Pilih paket yang ingin Anda beli, atau pilih Input Manual:', components: [row], ephemeral: true });
                } else if (customId === 'product_buy_btn') {
                    await interaction.deferReply({ ephemeral: true });
                    const Product = require('../models/Product');
                    const products = await Product.find({ active: true });
                    
                    if (products.length === 0) {
                        return interaction.editReply('Toko saat ini tidak memiliki produk aktif.');
                    }
                    
                    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('product_buy_select')
                        .setPlaceholder('Pilih produk yang ingin dibeli');
                        
                    products.forEach(p => {
                        select.addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(p.name)
                                .setDescription(`Harga: Rp ${p.price.toLocaleString('id-ID')} | Stok: ${p.stock}`)
                                .setValue(p.name)
                        );
                    });
                    
                    const row = new ActionRowBuilder().addComponents(select);
                    await interaction.editReply({ content: 'Pilih produk yang ingin Anda beli dari daftar di bawah ini:', components: [row] });
                }
            } catch (error) {
                console.error('Button Interaction Error:', error);
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'Terdapat kesalahan memproses tombol ini!', ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'Terdapat kesalahan memproses tombol ini!', ephemeral: true });
                    }
                } catch (replyError) {
                    console.error('Failed to send button error message:', replyError);
                }
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'admin_select_layout') {
                const style = interaction.values[0];
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                const modal = new ModalBuilder()
                    .setCustomId(`admin_layout_modal:${style}`)
                    .setTitle('Update Server Layout');
                const targetInput = new TextInputBuilder()
                    .setCustomId('target_guild_id')
                    .setLabel('Target Guild ID (ID Server)')
                    .setPlaceholder('Masukkan ID server yang akan diupdate...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMinLength(15)
                    .setMaxLength(25);
                modal.addComponents(new ActionRowBuilder().addComponents(targetInput));
                return await interaction.showModal(modal);
            } else if (interaction.customId === 'admin_select_template') {
                const templateType = interaction.values[0];
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                const modal = new ModalBuilder()
                    .setCustomId(`admin_autogen_modal:${templateType}`)
                    .setTitle('Generate Server Template');
                const targetInput = new TextInputBuilder()
                    .setCustomId('target_guild_id')
                    .setLabel('Target Guild ID (ID Server Baru)')
                    .setPlaceholder('Masukkan ID server baru tempat men-generate...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMinLength(15)
                    .setMaxLength(25);
                modal.addComponents(new ActionRowBuilder().addComponents(targetInput));
                return await interaction.showModal(modal);
            } else if (interaction.customId === 'admin_select_actions') {
                const selectedValue = interaction.values[0];
                await interaction.deferReply({ ephemeral: true });

                if (selectedValue === 'manage_prices') {
                    await interaction.editReply('💡 Untuk mengelola harga paket Robux, Anda dapat menggunakan slash command berikut:\n• `/store prices <packages>`\n*Contoh: `/store prices 100:15000, 500:70000`*');
                } else if (selectedValue === 'config_welcome') {
                    await interaction.editReply('👋 Untuk mengatur modul Welcome/Penyambutan member baru, gunakan slash command:\n• `/welcome setup <channel> <role>`\n• `/welcome message <text>`\n• `/welcome enable` atau `/welcome disable`');
                } else if (selectedValue === 'config_leave') {
                    await interaction.editReply('🚪 Untuk mengatur modul Goodbye/Perpisahan member keluar, gunakan slash command:\n• `/goodbye setup <channel>`\n• `/goodbye message <text>`\n• `/goodbye enable` atau `/goodbye disable`');
                } else if (selectedValue === 'view_orders') {
                    const Order = require('../models/Order');
                    const ProductOrder = require('../models/ProductOrder');

                    const recentRobux = await Order.find().sort({ createdAt: -1 }).limit(5);
                    const recentProducts = await ProductOrder.find().sort({ createdAt: -1 }).limit(5);

                    let list = '📋 **5 Transaksi Robux Terakhir:**\n';
                    if (recentRobux.length === 0) {
                        list += '• Belum ada transaksi Robux.\n';
                    } else {
                        recentRobux.forEach(o => {
                            list += `• ID: \`${o.orderId}\` | User: <@${o.userId}> | ${o.robuxAmount} R$ | Rp ${o.price.toLocaleString('id-ID')} | Status: \`${o.status}\`\n`;
                        });
                    }

                    list += '\n📋 **5 Transaksi Produk Terakhir:**\n';
                    if (recentProducts.length === 0) {
                        list += '• Belum ada transaksi Produk.\n';
                    } else {
                        recentProducts.forEach(o => {
                            list += `• ID: \`${o.orderId}\` | User: <@${o.userId}> | ${o.productName} | Rp ${o.price.toLocaleString('id-ID')} | Status: \`${o.status}\`\n`;
                        });
                    }

                    await interaction.editReply(list);
                }
            } else if (interaction.customId === 'store_order_select') {
                const selectedValue = interaction.values[0];
                
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                const modal = new ModalBuilder()
                    .setCustomId('store_order_modal')
                    .setTitle('Order Robux');
                    
                const robuxInput = new TextInputBuilder()
                    .setCustomId('robux_amount')
                    .setLabel('Jumlah Robux')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                    
                if (selectedValue !== 'manual') {
                    robuxInput.setValue(selectedValue);
                }
                                    const usernameInput = new TextInputBuilder()
                        .setCustomId('roblox_username')
                        .setLabel('Username Roblox')
                        .setPlaceholder('Pastikan benar! Kesalahan username bukan tanggung jawab admin.')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);
                        
                    modal.addComponents(new ActionRowBuilder().addComponents(robuxInput), new ActionRowBuilder().addComponents(usernameInput));
                    return interaction.showModal(modal);
                } else if (interaction.customId === 'product_buy_select') {
                    const selectedProductName = interaction.values[0];
                    const Product = require('../models/Product');
                    const product = await Product.findOne({ name: selectedProductName });
                    
                    if (!product || !product.active) {
                        return interaction.reply({ content: 'Produk tidak ditemukan atau sudah tidak aktif.', ephemeral: true });
                    }
                    
                    if (product.stock <= 0) {
                        return interaction.reply({ content: 'Maaf, stok produk ini sedang kosong.', ephemeral: true });
                    }

                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const modal = new ModalBuilder()
                        .setCustomId(`product_buy_modal:${selectedProductName}`)
                        .setTitle(`Beli Produk`);

                    const quantityInput = new TextInputBuilder()
                        .setCustomId('product_quantity')
                        .setLabel('Jumlah Pembelian')
                        .setStyle(TextInputStyle.Short)
                        .setValue('1')
                        .setRequired(true);
                        
                    const infoInput = new TextInputBuilder()
                        .setCustomId('product_info')
                        .setLabel('Catatan / Username / Detail Info')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Masukkan detail pesanan atau catatan tambahan jika ada...')
                        .setRequired(false);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(quantityInput),
                        new ActionRowBuilder().addComponents(infoInput)
                    );
                    
                    return interaction.showModal(modal);
                }
            } else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('product_buy_modal:')) {
                const selectedProductName = interaction.customId.split(':')[1];
                const quantityStr = interaction.fields.getTextInputValue('product_quantity');
                const infoStr = interaction.fields.getTextInputValue('product_info') || '-';
                const quantity = parseInt(quantityStr);

                if (isNaN(quantity) || quantity <= 0) {
                    return interaction.reply({ content: 'Jumlah pembelian harus berupa angka yang valid dan lebih dari 0.', ephemeral: true });
                }

                const Product = require('../models/Product');
                const product = await Product.findOne({ name: selectedProductName });

                if (!product || !product.active) {
                    return interaction.reply({ content: 'Produk tidak ditemukan atau sudah tidak aktif.', ephemeral: true });
                }
                
                if (product.stock < quantity) {
                    return interaction.reply({ content: `Maaf, stok tidak cukup. Sisa stok saat ini: ${product.stock}`, ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });
                
                // Reduce stock
                product.stock -= quantity;
                const totalPrice = product.price * quantity;
                await product.save();

                const { updateProductEmbed } = require('../services/productService');
                await updateProductEmbed(interaction.client, interaction.guild.id);

                const ticketId = `prod-${interaction.user.id.slice(-4)}-${Date.now().toString().slice(-4)}`;

                const channel = await interaction.guild.channels.create({
                    name: `order-${interaction.user.username}`,
                    type: 0,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: ['ViewChannel'] },
                        { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                        { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] },
                        { id: '1505190278003298324', allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }, // Owner
                        { id: '1517049069166526546', allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }  // Admin
                    ],
                });

                const Ticket = require('../models/Ticket');
                await Ticket.create({
                    ticketId: channel.id,
                    ownerId: interaction.user.id,
                    category: 'product'
                });
                
                const ProductOrder = require('../models/ProductOrder');
                await ProductOrder.create({
                    orderId: ticketId,
                    userId: interaction.user.id,
                    productName: `${product.name} (x${quantity})`,
                    price: totalPrice,
                    channelId: channel.id,
                    status: 'pending'
                });

                // Auto notes logic
                const nameLower = product.name.toLowerCase();
                let productNotes = 'Akan diproses secepatnya.';
                
                if (nameLower.includes('bot')) {
                    productNotes = 'Estimasi pengerjaan paling lama 3 - 7 hari.';
                } else if (nameLower.includes('decoration') || nameLower.includes('deco')) {
                    productNotes = 'Proses via login, paling lama bisa beberapa jam.';
                } else if (nameLower.includes('akun') || nameLower.includes('nitro')) {
                    productNotes = 'Proses tergantung antrian yang ada.';
                }

                const paymentInfo = `\n\n**🏦 Informasi Pembayaran:**\n• **Seabank** -> 901269725883 [Guntur]\n• **Dana** -> 082110831473 [Guntur]\n• **Gopay** -> 081519308407 [Kai]\n• **Shopepay** -> 0881080702615 [WinterStoree]\n\n_Silakan lakukan transfer sesuai dengan nominal harga pesanan Anda. Setelah itu, **kirimkan bukti pembayaran Anda di channel ini** dan jangan lupa tag Admin (<@&1517049069166526546>) atau Owner (<@&1505190278003298324>) agar pesanan segera diproses!_`;

                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle('🛒 Pesanan Produk WinterBot')
                    .setDescription(`Halo ${interaction.user}, terima kasih banyak telah mempercayai layanan kami! ✨\nPesananmu sudah kami terima dan stok telah berhasil di-booking. Staf kami akan segera meninjau pesanan ini.\n\n**📦 Detail Pesanan:**\n• **Produk:** ${product.name} (x${quantity})\n• **Harga Satuan:** Rp ${product.price.toLocaleString('id-ID')}\n• **Total Harga:** Rp ${totalPrice.toLocaleString('id-ID')}\n• **Catatan:** ${infoStr}\n• **Status:** 🟡 Pending\n\n**📌 Notes Penting:** \n📝 *${productNotes}*${paymentInfo}`)
                    .setColor('#0099ff');
                    
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('staff_delivered_product').setLabel('Mark Delivered').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('staff_cancel_product').setLabel('Cancel Order').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                );
                
                await channel.send({ content: `${interaction.user} | <@&1505190278003298324> <@&1517049069166526546>`, embeds: [embed], components: [row] });
                
                await interaction.editReply(`✅ Tiket pesanan berhasil dibuat! Silakan lanjutkan ke tiket: ${channel}`);
            } else if (interaction.customId.startsWith('admin_layout_modal:')) {
                const style = interaction.customId.split(':')[1];
                const targetGuildId = interaction.fields.getTextInputValue('target_guild_id');
                
                await interaction.deferReply({ ephemeral: true });
                
                try {
                    const targetGuild = await interaction.client.guilds.fetch(targetGuildId).catch(() => null);
                    if (!targetGuild) {
                        return interaction.editReply('❌ **Gagal:** Server target tidak ditemukan atau bot tidak memiliki akses ke server tersebut.');
                    }

                    const layoutManager = require('../services/layoutManager');
                    const { EmbedBuilder } = require('discord.js');
                    
                    const embed = new EmbedBuilder()
                        .setTitle('Server Layout Update')
                        .setDescription(`Applying the **${style.toUpperCase()}** layout style to **${targetGuild.name}**...\n\n*Please wait, this will take some time due to Discord rate limits (approx 1.5s per channel).*`)
                        .setColor('#5865F2');

                    await interaction.editReply({ embeds: [embed] });

                    let lastUpdate = Date.now();
                    const progressCallback = async (updated, total) => {
                        const now = Date.now();
                        if (now - lastUpdate > 5000) {
                            lastUpdate = now;
                            embed.setDescription(`Applying the **${style.toUpperCase()}** layout style to **${targetGuild.name}**...\n\nProgress: **${updated}** channels updated.`);
                            await interaction.editReply({ embeds: [embed] }).catch(() => {});
                        }
                    };

                    const result = await layoutManager.applyLayout(targetGuild, style, progressCallback);

                    const finalEmbed = new EmbedBuilder()
                        .setTitle('Server Layout Update Complete')
                        .setDescription(`Successfully applied the **${style.toUpperCase()}** layout style to **${targetGuild.name}**.`)
                        .addFields(
                            { name: 'Updated Channels', value: `${result.updated}`, inline: true },
                            { name: 'Errors', value: `${result.errors}`, inline: true }
                        )
                        .setColor('#57F287');

                    await interaction.editReply({ embeds: [finalEmbed] });
                } catch (error) {
                    await interaction.followUp({ content: `An error occurred: ${error.message}`, ephemeral: true });
                }
            } else if (interaction.customId === 'admin_wipe_modal') {
                await interaction.deferReply({ ephemeral: true });
                const targetGuildId = interaction.fields.getTextInputValue('target_guild_id');
                const confirmText = interaction.fields.getTextInputValue('confirm_wipe');
                
                if (confirmText !== 'WIPE') {
                    return interaction.editReply('❌ **Konfirmasi Gagal:** Anda harus mengetik kata `WIPE` secara tepat untuk mengonfirmasi penghapusan.');
                }
                
                const { wipeGuild } = require('../services/cloneService');
                const { updateAdminPanel } = require('../services/adminService');
                try {
                    await interaction.editReply('⏳ Sedang menghapus seluruh isi server target (roles, channels, and categories)...');
                    const result = await wipeGuild(interaction.client, targetGuildId);
                    await updateAdminPanel(interaction.client);
                    await interaction.editReply(`✅ **Server Berhasil Dibersihkan!**\n\n• Server Target: **${result.targetGuildName}**\n• Roles Deleted: **${result.rolesDeletedCount}**\n• Seluruh kategori dan channel berhasil dihapus.`);
                } catch (error) {
                    console.error('[Wipe Modal Error]', error);
                    await interaction.editReply(`❌ **Pembersihan Gagal:** ${error.message}`);
                }
            } else if (interaction.customId.startsWith('admin_autogen_modal:')) {
                await interaction.deferReply({ ephemeral: true });
                const templateType = interaction.customId.split(':')[1];
                const targetGuildId = interaction.fields.getTextInputValue('target_guild_id');
                const { generateTemplate } = require('../services/cloneService');
                const { updateAdminPanel } = require('../services/adminService');

                try {
                    await interaction.editReply(`⏳ Sedang menggenerasi template **${templateType}** pada server target...`);
                    const result = await generateTemplate(interaction.client, targetGuildId, templateType);

                    await updateAdminPanel(interaction.client);
                    await interaction.editReply(`✅ **Generasi Server Berhasil!**\n\n• Server Target: **${result.targetGuildName}**\n• Template: **${templateType}**\n• Roles Created: **${result.rolesCreated}**\n• Categories Created: **${result.categoriesCreated}**\n• Channels Created: **${result.channelsCreated}**\n\n*Pusat Kontrol (Administration) juga telah ditambahkan ke server target.*`);
                } catch (error) {
                    console.error('[AutoGen Modal Error]', error);
                    await interaction.editReply(`❌ **Generasi Gagal:** ${error.message}`);
                }
            } else if (interaction.customId === 'admin_clone_modal') {
                await interaction.deferReply({ ephemeral: true });
                const targetGuildId = interaction.fields.getTextInputValue('target_guild_id');
                const { cloneGuild } = require('../services/cloneService');
                const { updateAdminPanel } = require('../services/adminService');

                try {
                    await interaction.editReply('⏳ Sedang memproses kloning server (Copying roles, channels, and configs)...');
                    const result = await cloneGuild(interaction.client, interaction.guild, targetGuildId);
                    
                    // Update admin panel stats
                    await updateAdminPanel(interaction.client);

                    await interaction.editReply(`✅ **Sinkronisasi / Kloning Server Berhasil!**\n\n• Server Target: **${result.targetGuildName}**\n• Roles Created: **${result.rolesCreatedCount}**\n• Categories Created: **${result.categoriesCreatedCount}**\n• Channels Created: **${result.channelsCreatedCount}**\n• Konfigurasi database & panel otomatis dideploy!`);
                } catch (error) {
                    console.error('[Clone Modal Error]', error);
                    await interaction.editReply(`❌ **Sinkronisasi Gagal:** ${error.message}`);
                }
            } else if (interaction.customId === 'verify_modal') {
                await interaction.deferReply({ ephemeral: true });

                const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
                const discordId = interaction.user.id;

                try {
                    const { verifyRobloxUsername } = require('../services/robloxService');
                    const noblox = require('noblox.js');
                    const User = require('../models/User');

                    const verification = await verifyRobloxUsername(robloxUsername);
                    if (!verification.success) {
                        return interaction.editReply('❌ Username Roblox tidak ditemukan.');
                    }

                    // Cek apakah user ada di Community Roblox
                    const groupId = parseInt(process.env.GROUP_ID);
                    if (!groupId) {
                        return interaction.editReply('❌ Sistem belum dikonfigurasi sepenuhnya (GROUP_ID belum diset). Harap hubungi Admin.');
                    }

                    const rankInGroup = await noblox.getRankInGroup(groupId, verification.id).catch(() => 0);
                    if (rankInGroup === 0) {
                        return interaction.editReply(`❌ Akun **${verification.username}** belum bergabung ke Community Roblox kami.\nSilakan join community terlebih dahulu, lalu coba lagi.`);
                    }

                    // Check server join duration
                    const member = interaction.member;
                    const joinedAt = member.joinedAt;
                    const diffTime = Math.abs(new Date() - joinedAt);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    const isEligible = diffDays >= 14;

                    // Update or Create user in MongoDB
                    await User.findOneAndUpdate(
                        { discordId },
                        {
                            discordId,
                            robloxId: verification.id,
                            robloxUsername: verification.username,
                            verified: true,
                            eligibleForPayout: isEligible
                        },
                        { upsert: true, new: true }
                    );

                    let replyMessage = `✅ Roblox account berhasil diverifikasi sebagai **${verification.username}** (ID: ${verification.id})\n\n`;
                    replyMessage += `📅 Kamu sudah bergabung di server ini selama **${diffDays} hari**.\n`;
                    
                    if (isEligible) {
                        replyMessage += `🎉 **Selamat!** Kamu sudah memenuhi syarat durasi bergabung (14 hari) untuk menerima Robux Payout.`;
                        
                        const roleId = process.env.ELIGIBLE_ROLE_ID;
                        if (roleId) {
                            try {
                                await member.roles.add(roleId);
                            } catch (err) {
                                console.error('Failed to add role:', err);
                            }
                        }
                    } else {
                        replyMessage += `⏳ Kamu masih belum memenuhi syarat durasi server (butuh 14 hari). Sisa waktu: **${14 - diffDays} hari** lagi.`;
                    }

                    // --- COMMUNITY MONITOR LOG ---
                    try {
                        const payoutChannelId = process.env.PAYOUT_LOG_CHANNEL_ID || '1518214414254211202';
                        const payoutChannel = await interaction.client.channels.fetch(payoutChannelId).catch(() => null);
                        
                        if (payoutChannel) {
                            const { EmbedBuilder } = require('discord.js');
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
                                    .setTitle('Community Monitor • WinterStore')
                                    .setDescription(`${playerInfo.displayName} ( @${playerInfo.username} )\n✅ Member Joined the Community`)
                                    .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${verification.id}&width=420&height=420&format=png`)
                                    .addFields(
                                        { name: '🆔 Username', value: `@${playerInfo.username}`, inline: true },
                                        { name: '👤 User ID', value: `${verification.id}`, inline: true },
                                        { name: '🏷️ Display Name', value: `${playerInfo.displayName}`, inline: true },
                                        { name: '👥 Followers', value: `${playerInfo.followerCount || 0}`, inline: true },
                                        { name: '➡️ Following', value: `${playerInfo.followingCount || 0}`, inline: true },
                                        { name: '🤝 Connections', value: `${playerInfo.friendCount || 0}`, inline: true },
                                        { name: '📅 Account Created', value: `<t:${Math.floor(accCreatedDate.getTime() / 1000)}:f>`, inline: true },
                                        { name: '⏳ Account Age', value: accAgeString, inline: true },
                                        { name: '🔞 Age Group', value: 'Unknown', inline: true },
                                        { name: '🛡️ Account Status', value: playerInfo.isBanned ? '❌ Banned' : '✅ Active', inline: true },
                                        { name: '📥 Join Community Date', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                                        { name: '✅ Eligible Date (+14 Days)', value: `<t:${Math.floor(eligibleDate.getTime() / 1000)}:f>`, inline: true }
                                    )
                                    .setFooter({ text: 'WinterStore • Join Event • Multi-Source Verified', iconURL: interaction.guild.iconURL() })
                                    .setColor('#2b2d31');
                                    
                                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                                const row = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`check_eligibility_${interaction.user.id}`)
                                        .setLabel('🔄 Update Status Payout')
                                        .setStyle(ButtonStyle.Primary)
                                );
                                await payoutChannel.send({ content: `<@${interaction.user.id}> telah bergabung dan diverifikasi!`, embeds: [monitorEmbed], components: [row] });
                            }
                        }
                    } catch (logErr) {
                        console.error('Failed to send community monitor log:', logErr);
                    }
                    // -----------------------------

                    await interaction.editReply(replyMessage);
                } catch (error) {
                    console.error('Verify error:', error);
                    await interaction.editReply('❌ Terjadi kesalahan saat memverifikasi akun Anda.');
                }
            } else if (interaction.customId === 'store_order_modal') {
                try {
                    const amountStr = interaction.fields.getTextInputValue('robux_amount');
                    const username = interaction.fields.getTextInputValue('roblox_username');
                    const amount = parseInt(amountStr);
                    
                    if (isNaN(amount) || amount <= 0) {
                        return interaction.reply({ content: 'Jumlah Robux harus berupa angka valid.', ephemeral: true });
                    }
                    
                    await interaction.deferReply({ ephemeral: true });
                    
                    const StoreConfig = require('../models/StoreConfig');
                    const config = await StoreConfig.findOne({ guildId: interaction.guild.id });
                    
                    let price = 0;
                    let priceStr = 'Dihitung Admin';
                    if (config && config.packages) {
                        const pkg = config.packages.find(p => p.amount === amount);
                        if (pkg) {
                            price = pkg.price;
                            priceStr = `Rp ${price.toLocaleString('id-ID')}`;
                        }
                    }
                    
                    const ticketId = `order-${interaction.user.id.slice(-4)}-${Date.now().toString().slice(-4)}`;
                    
                    const channel = await interaction.guild.channels.create({
                        name: `order-${interaction.user.username}`,
                        type: 0,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: ['ViewChannel'] },
                            { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                            { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] },
                            { id: '1505190278003298324', allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }, // Owner
                            { id: '1517049069166526546', allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }  // Admin
                        ],
                    });
                    
                    const Order = require('../models/Order');
                    await Order.create({
                        orderId: ticketId,
                        userId: interaction.user.id,
                        robloxUsername: username,
                        channelId: channel.id,
                        robuxAmount: amount,
                        price: price,
                        status: 'pending'
                    });
                    
                    const Ticket = require('../models/Ticket');
                    await Ticket.create({
                        ticketId: channel.id,
                        ownerId: interaction.user.id,
                        category: 'order'
                    });
                    
                    const paymentInfo = `\n\n**🏦 Informasi Pembayaran:**\n• **Seabank** -> 901269725883 [Guntur]\n• **Dana** -> 082110831473 [Guntur]\n• **Gopay** -> 081519308407 [Kai]\n• **Shopepay** -> 0881080702615 [WinterStoree]\n\n_Silakan lakukan transfer sesuai dengan nominal harga pesanan Anda. Setelah itu, **kirimkan bukti pembayaran Anda di channel <#1517638154889199656>** dan jangan lupa tag Admin (<@&1517049069166526546>) atau Owner (<@&1505190278003298324>) agar pesanan segera diproses!_`;

                    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                    const embed = new EmbedBuilder()
                        .setTitle('🛒 Pesanan Robux')
                        .setDescription(`Halo ${interaction.user}, staf kami akan segera memproses pesanan Anda.\n\n**Detail Pesanan:**\n• Username Roblox: **${username}**\n• Jumlah: ${amount} R$\n• Harga: ${priceStr}\n• Status: 🟡 Pending\n\n⚠️ **PENTING:** Pastikan username Roblox Anda sudah benar! Kesalahan username bukan tanggung jawab admin!${paymentInfo}`)
                        .setColor('#ffff00');
                        
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('staff_delivered').setLabel('Mark Delivered').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('staff_cancel').setLabel('Cancel Order').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                    );
                    
                    await channel.send({ content: `${interaction.user} | <@&1505190278003298324> <@&1517049069166526546>`, embeds: [embed], components: [row] });
                    
                    // Coba menghapus pesan Select Menu jika ada
                    try {
                        if (interaction.message) {
                            await interaction.message.delete();
                        }
                    } catch (e) {}
                    
                    await interaction.editReply(`✅ Pesanan dibuat! Silakan lanjutkan pembayaran di tiket: ${channel}`);
                    
                    // 1 Hour Auto-Cancel logic
                    setTimeout(async () => {
                        try {
                            const checkOrder = await Order.findOne({ orderId: ticketId });
                            if (checkOrder && checkOrder.status === 'pending') {
                                checkOrder.status = 'cancelled';
                                await checkOrder.save();

                                await Ticket.findOneAndUpdate({ ticketId: channel.id }, { status: 'closed' });

                                try {
                                    const customer = await interaction.client.users.fetch(interaction.user.id);
                                    if (customer) {
                                        const dmMessage = `Halo kak ${interaction.user.username} 👋\n\nMohon maaf sebesar-besarnya 🙏 pesanan Robux kakak di **WinterStore** (Order ID: **${checkOrder.orderId}**) terpaksa kami **batalkan otomatis** karena tidak ada respon atau konfirmasi pembayaran yang kami terima selama 1 jam terakhir.\n\nJika kakak masih ingin melakukan pembelian atau sudah melakukan transfer namun lupa mengirimkan bukti, silakan buat tiket pesanan baru ya kak!\n\nTerima kasih,\n❄️ **WinterStore Team**`;
                                        await customer.send(dmMessage);
                                    }
                                } catch (e) {
                                    console.error('Failed to DM user on auto-cancel:', e);
                                }

                                try {
                                    const msgs = await channel.messages.fetch({ limit: 10 });
                                    const botMsg = msgs.find(m => m.author.id === interaction.client.user.id && m.embeds.length > 0);
                                    if (botMsg) {
                                        const { EmbedBuilder } = require('discord.js');
                                        const oldEmbed = botMsg.embeds[0];
                                        const newEmbed = EmbedBuilder.from(oldEmbed)
                                            .setDescription(oldEmbed.description.replace('🟡 Pending', '🔴 Cancelled (Timeout)'))
                                            .setColor('#ff0000');
                                        await botMsg.edit({ embeds: [newEmbed], components: [] }).catch(() => {});
                                    }
                                    await channel.send('⏳ **Sistem Otomatis:** Pesanan dibatalkan karena tidak ada konfirmasi/respons selama 1 jam. Tiket ini akan ditutup dalam 10 detik.');
                                } catch (e) {}

                                setTimeout(() => {
                                    channel.delete().catch(() => {});
                                }, 10000);
                            }
                        } catch (err) {
                            console.error('Error in auto-cancel timeout:', err);
                        }
                    }, 60 * 60 * 1000); // 1 hour

                    
                } catch (error) {
                    console.error('Modal Submit Error:', error);
                    await interaction.reply({ content: 'Gagal memproses pesanan.', ephemeral: true }).catch(() => {});
                }
            } else if (interaction.customId === 'verify_modal') {
                await interaction.deferReply({ ephemeral: true });

                const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
                const discordId = interaction.user.id;

                try {
                    const { verifyRobloxUsername } = require('../services/robloxService');
                    const noblox = require('noblox.js');
                    const User = require('../models/User');

                    const verification = await verifyRobloxUsername(robloxUsername);
                    if (!verification.success) {
                        return interaction.editReply('❌ Username Roblox tidak ditemukan.');
                    }

                    // Cek apakah user ada di Community Roblox
                    const groupId = parseInt(process.env.GROUP_ID);
                    if (!groupId) {
                        return interaction.editReply('❌ Sistem belum dikonfigurasi sepenuhnya (GROUP_ID belum diset). Harap hubungi Admin.');
                    }

                    const rankInGroup = await noblox.getRankInGroup(groupId, verification.id).catch(() => 0);
                    if (rankInGroup === 0) {
                        return interaction.editReply(`❌ Akun **${verification.username}** belum bergabung ke Community Roblox kami.\nSilakan join community terlebih dahulu, lalu coba lagi.`);
                    }

                    // Cek apakah user ada di database
                    let userRecord = await User.findOne({ discordId });
                    
                    // Jika belum ada, buat record baru dengan createdAt = hari ini (saat dia verifikasi)
                    if (!userRecord) {
                        userRecord = await User.create({
                            discordId,
                            robloxId: verification.id,
                            robloxUsername: verification.username,
                            verified: true,
                            eligibleForPayout: false
                        });
                    } else {
                        // Jika sudah ada, update datanya
                        userRecord.robloxId = verification.id;
                        userRecord.robloxUsername = verification.username;
                        userRecord.verified = true;
                    }

                    // Check community join duration using userRecord.createdAt (tanggal dia verifikasi)
                    // Karena Roblox API tidak menyediakan tanggal join grup, kita menghitung 14 hari
                    // dimulai dari saat user mendaftarkan akunnya di sistem ini.
                    const joinedAt = userRecord.createdAt;
                    const diffTime = Math.abs(new Date() - joinedAt);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    const isEligible = diffDays >= 14;
                    userRecord.eligibleForPayout = isEligible;
                    await userRecord.save();

                    let dmMessage = `✅ Roblox account berhasil diverifikasi sebagai **${verification.username}** (ID: ${verification.id})\n\n`;
                    dmMessage += `📅 Kamu sudah bergabung di **Community Roblox** ini selama **${diffDays} hari** (dihitung sejak tanggal verifikasi).\n`;
                    
                    if (isEligible) {
                        dmMessage += `🎉 **Selamat!** Kamu sudah memenuhi syarat durasi bergabung (14 hari) di Community untuk menerima Robux Payout.`;
                        
                        const roleId = process.env.ELIGIBLE_ROLE_ID;
                        if (roleId) {
                            try {
                                await interaction.member.roles.add(roleId);
                            } catch (err) {
                                console.error('Failed to add role:', err);
                            }
                        }
                    } else {
                        dmMessage += `⏳ Kamu masih belum memenuhi syarat durasi Community Roblox (butuh 14 hari). Sisa waktu: **${14 - diffDays} hari** lagi.`;
                    }

                    try {
                        await interaction.user.send(dmMessage);
                        await interaction.editReply('✅ Verifikasi berhasil diproses! Silakan cek pesan masuk (DM) Anda dari bot ini.');
                    } catch (dmError) {
                        console.error('Failed to DM user:', dmError);
                        await interaction.editReply(`✅ Verifikasi berhasil! Namun bot tidak dapat mengirimkan DM ke akun Anda (DM ditutup).\n\n${dmMessage}`);
                    }
                } catch (error) {
                    console.error('Verify error:', error);
                    await interaction.editReply('❌ Terjadi kesalahan saat memverifikasi akun Anda.');
                }
            }
        }
    },
};
