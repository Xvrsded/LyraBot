const fs = require('fs');

const path = 'src/events/interactionCreate.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const injectionCode = `            }

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
                    const orderId = \`LB-\${String(totalOrders + 1).padStart(6, '0')}\`;

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
                    const channelName = \`\${channelPrefix}-\${amountDisplay}r-\${interaction.user.username}\`;
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

                    const { AttachmentBuilder } = require('discord.js');
                    const path = require('path');
                    const qrPath = path.join(__dirname, '../../Public/QR Payment.jpg');
                    const qrAttachment = new AttachmentBuilder(qrPath, { name: 'qris.jpg' });

                    let ticketEmbed;
                    if (isGIG) {
                        ticketEmbed = new EmbedBuilder()
                            .setTitle('🛒 Pesanan LyraBlox')
                            .setDescription(
                                \`Halo <@\${interaction.user.id}>,\\n\\n\` +
                                \`Terima kasih telah menggunakan layanan Gift In Game LyraBlox.\\n\` +
                                \`Pesanan Anda berhasil dibuat.\\n\\n━━━━━━━━━━━━━━━━━━━━━━\\n\\n\` +
                                \`📦 **Detail Pesanan**\`
                            )
                            .setColor('#f43f5e')
                            .addFields(
                                { name: '📦 Produk', value: 'Gift In Game', inline: true },
                                { name: '🎮 Game', value: session.gameLink, inline: true },
                                { name: '🎁 Gamepass', value: session.gamepassName, inline: true },
                                { name: '💎 Harga Gamepass', value: \`\${session.amount.toLocaleString('id-ID')} Robux\`, inline: true },
                                { name: '💰 Total Pembayaran', value: \`Rp \${session.price.toLocaleString('id-ID')}\`, inline: true },
                                { name: '📌 Status', value: '🟡 Pending', inline: true },
                                { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\\u200b', inline: false },
                                { name: '💳 Pembayaran', value: \`Silakan lakukan pembayaran sesuai dengan total yang tertera di atas.\\n\\n🟦 **GoPay**\\n\\\`081393625527\\\`\`, inline: false },
                                { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\\u200b', inline: false },
                                { 
                                    name: '📝 Catatan Pembayaran', 
                                    value: 
                                        '• Maksimal pembayaran melalui QRIS adalah Rp500.000 untuk setiap transaksi.\\n' +
                                        '• Untuk transaksi di atas Rp500.000, silakan lakukan pembayaran lebih dari satu kali, atau gunakan satu kali pembayaran dengan tambahan biaya QRIS sebesar 0,3%.\\n' +
                                        '• Apabila melakukan transfer ke GoPay menggunakan Bank atau E-Wallet selain GoPay, akan dikenakan biaya tambahan sebesar Rp1.000 sesuai ketentuan penyedia layanan.\\n' +
                                        '• Pastikan nominal pembayaran sesuai dengan total yang tertera pada Ticket.\\n' +
                                        '• Setelah pembayaran selesai, kirim bukti transfer langsung pada Ticket ini.\\n' +
                                        '• Bot akan mendeteksi bukti pembayaran secara otomatis.',
                                    inline: false 
                                }
                            )
                            .setImage('attachment://qris.jpg')
                            .setTimestamp();
                    } else {
                        ticketEmbed = new EmbedBuilder()
                            .setTitle('🛒 Pesanan LyraBlox')
                            .setDescription(
                                \`Halo <@\${interaction.user.id}>,\\n\\n\` +
                                \`Terima kasih telah mempercayai pembelian Robux kepada LyraBlox.\\n\` +
                                \`Pesanan Anda berhasil dibuat.\\n\` +
                                \`Silakan lakukan pembayaran sesuai instruksi di bawah ini.\\n\`
                            )
                            .addFields(
                                { name: '📦 Produk', value: productName, inline: true },
                                { name: '🎁 Paket', value: session.isCustom ? 'Custom' : \`\${session.amount.toLocaleString('id-ID')} Robux\`, inline: true },
                                ...(session.isCustom ? [{ name: '💎 Jumlah Robux', value: \`\${session.amount.toLocaleString('id-ID')} Robux\`, inline: true }] : []),
                                { name: '💰 Total', value: \`Rp \${session.price.toLocaleString('id-ID')}\`, inline: true },
                                { name: '📌 Status', value: '🟡 Pending', inline: true },
                                { name: '👤 Username', value: session.robloxUsername, inline: true },
                                ...(isVisend ? [] : [{ name: '🔑 Password', value: \`||\${session.robloxPassword}||\`, inline: true }]),
                                { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\\u200b', inline: false },
                                { name: '💳 Pembayaran', value: \`Silakan lakukan pembayaran sesuai dengan total yang tertera di atas.\\n\\n🟦 **GoPay**\\n\\\`081393625527\\\`\`, inline: false },
                                { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\\u200b', inline: false },
                                { 
                                    name: '📝 Catatan Pembayaran', 
                                    value: 
                                        '• Maksimal pembayaran melalui QRIS adalah Rp500.000 untuk setiap transaksi.\\n' +
                                        '• Untuk transaksi di atas Rp500.000, silakan lakukan pembayaran lebih dari satu kali, atau gunakan satu kali pembayaran dengan tambahan biaya QRIS sebesar 0,3%.\\n' +
                                        '• Apabila melakukan transfer ke GoPay menggunakan Bank atau E-Wallet selain GoPay, akan dikenakan biaya tambahan sebesar Rp1.000 sesuai ketentuan penyedia layanan.\\n' +
                                        '• Pastikan nominal pembayaran sesuai dengan total yang tertera pada Ticket.\\n' +
                                        '• Setelah pembayaran selesai, kirim bukti transfer langsung pada Ticket ini.\\n' +
                                        '• Bot akan mendeteksi bukti pembayaran secara otomatis.',
                                    inline: false 
                                }
                            )
                            .setImage('attachment://qris.jpg')
                            .setColor('#ffaa00')
                            .setTimestamp();
                    }

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(\`robux_deliver_\${orderId}\`).setLabel('Mark Delivered').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                    );
                    
                    if (isVisend) {
                        row.addComponents(
                            new ButtonBuilder().setCustomId('tutorial_v2l').setLabel('🔐 Tutorial V2L').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tutorial_cek_limit').setLabel('📊 Cek Limit Robux').setStyle(ButtonStyle.Secondary)
                        );
                    }

                    const staffMention = staffRoleId ? \`<@&\${staffRoleId}>\` : '';
                    const adminMention = adminRoleId ? \`<@&\${adminRoleId}>\` : '';
                    await channel.send({ 
                        content: \`\${interaction.user} | \${staffMention} \${adminMention}\`, 
                        embeds: [ticketEmbed], 
                        components: [row],
                        files: [qrAttachment]
                    });

                    // Hapus sesi setelah sukses
                    orderSessions.delete(sessionId);

                    await interaction.editReply(\`✅ Pesanan dikonfirmasi! Silakan lanjutkan pembayaran di tiket: \${channel}\`);
                } catch (err) {
                    logger.error('[InteractionCreate] Error confirming order:', err);
                    return interaction.editReply('❌ Terjadi kesalahan saat memproses pesanan.');
                }
            }
        }`;

lines.splice(756, 0, injectionCode);
fs.writeFileSync(path, lines.join('\n'));
console.log('Successfully injected button handlers for confirm and cancel in interactionCreate.js');
