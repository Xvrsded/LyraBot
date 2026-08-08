const fs = require('fs');

const path = 'src/events/interactionCreate.js';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const newCode = `        // Handle Modal Submissions
        if (interaction.isModalSubmit()) {
            const { customId } = interaction;

            // 1. Robux Modal Order Submission (Vilog & Visend)
            if (customId.startsWith('vilog_modal_order:') || customId.startsWith('visend_modal_order:') || customId === 'visend_modal_custom') {
                const isVisend = customId.startsWith('visend_modal_order:') || customId === 'visend_modal_custom';
                const isCustom = customId === 'visend_modal_custom';

                await interaction.deferReply({ ephemeral: true });

                try {
                    let amount, price;
                    
                    if (isCustom) {
                        const amountStr = interaction.fields.getTextInputValue('robux_amount');
                        if (!/^\\d+$/.test(amountStr) || parseInt(amountStr) <= 0) {
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
                    const robloxPassword = isVisend ? '' : interaction.fields.getTextInputValue('roblox_password');

                    // Validasi Roblox Username
                    const userInfo = await getRobloxUserInfo(robloxUsername);
                    if (!userInfo.success) {
                        return interaction.editReply('❌ Username Roblox tidak ditemukan.\\n\\nSilakan periksa kembali Username yang Anda masukkan.\\nPastikan penulisan Username sudah benar.');
                    }

                    // Build Session
                    const sessionId = uuidv4();
                    orderSessions.set(sessionId, {
                        type: isVisend ? 'visend' : 'vilog',
                        isCustom, amount, price, 
                        robloxUsername: userInfo.username, 
                        robloxPassword, 
                        robloxId: userInfo.id,
                        displayName: userInfo.displayName,
                        avatarUrl: userInfo.avatarUrl
                    });

                    // Order Confirmation Embed
                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('🔍 Konfirmasi Akun Roblox')
                        .setDescription('Silakan pastikan seluruh informasi akun dan pesanan sudah benar sebelum melanjutkan.\\n\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n👤 **Informasi Akun**')
                        .addFields(
                            { name: 'Username', value: \`\\\`\${userInfo.username}\\\`\`, inline: true },
                            { name: 'Display Name', value: \`\\\`\${userInfo.displayName}\\\`\`, inline: true },
                            { name: 'User ID', value: \`\\\`\${userInfo.id}\\\`\`, inline: true },
                            { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '📦 **Informasi Pesanan**', inline: false },
                            { name: 'Produk', value: \`\\\`\${isVisend ? 'Robux Via Send' : 'Robux Via Login'}\\\`\`, inline: true },
                            { name: 'Paket', value: \`\\\`\${isCustom ? 'Custom' : amount + ' Robux'}\\\`\`, inline: true },
                            { name: 'Jumlah Robux', value: \`\\\`\${amount}\\\`\`, inline: true },
                            { name: 'Total Pembayaran', value: \`\\\`Rp\${price.toLocaleString('id-ID')}\\\`\`, inline: true },
                            { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '\\u200b', inline: false }
                        )
                        .setThumbnail(userInfo.avatarUrl || 'https://tr.rbxcdn.com/default-headshot')
                        .setFooter({ text: 'Apabila seluruh informasi sudah sesuai, silakan tekan tombol Konfirmasi Pesanan.' })
                        .setColor('#ffaa00');

                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(\`confirm_order_\${sessionId}\`).setLabel('✅ Konfirmasi Pesanan').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(\`cancel_order_\${sessionId}\`).setLabel('✏️ Ubah Data').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setLabel('👤 Lihat Profil Roblox').setStyle(ButtonStyle.Link).setURL(\`https://www.roblox.com/users/\${userInfo.id}/profile\`)
                    );

                    return interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });
                } catch (err) {
                    logger.error('[InteractionCreate] Error submitting Robux modal:', err);
                    return interaction.editReply('❌ Gagal memproses pesanan Anda.');
                }
            }

            // 2. Gift In Game (GIG) Modal Order Submission
            if (customId === 'gig_modal_order') {
                await interaction.deferReply({ ephemeral: true });

                try {
                    const gameLink = interaction.fields.getTextInputValue('gig_game_link');
                    const gamepassName = interaction.fields.getTextInputValue('gig_gamepass_name');
                    const amountStr = interaction.fields.getTextInputValue('gig_robux_amount');
                    const robloxUsername = interaction.fields.getTextInputValue('roblox_username');

                    if (!/^\\d+$/.test(amountStr) || parseInt(amountStr) <= 0) {
                        return interaction.editReply('❌ Jumlah Robux tidak valid. Harap masukkan angka saja (tanpa titik/koma) dan lebih dari 0.');
                    }
                    const amount = parseInt(amountStr);
                    const rate = await settingsService.get('gig_rate', 90);
                    const price = amount * rate;

                    // Validasi Roblox Username
                    const userInfo = await getRobloxUserInfo(robloxUsername);
                    if (!userInfo.success) {
                        return interaction.editReply('❌ Username Roblox tidak ditemukan.\\n\\nSilakan periksa kembali Username yang Anda masukkan.\\nPastikan penulisan Username sudah benar.');
                    }

                    // Build Session
                    const sessionId = uuidv4();
                    orderSessions.set(sessionId, {
                        type: 'gig', amount, price, rate, gameLink, gamepassName,
                        robloxUsername: userInfo.username, robloxId: userInfo.id, displayName: userInfo.displayName, avatarUrl: userInfo.avatarUrl
                    });

                    // Order Confirmation Embed for GIG
                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('🔍 Konfirmasi Akun Roblox (Gift In Game)')
                        .setDescription('Silakan pastikan seluruh informasi akun dan pesanan sudah benar sebelum melanjutkan.\\n\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n👤 **Informasi Akun**')
                        .addFields(
                            { name: 'Username', value: \`\\\`\${userInfo.username}\\\`\`, inline: true },
                            { name: 'Display Name', value: \`\\\`\${userInfo.displayName}\\\`\`, inline: true },
                            { name: 'User ID', value: \`\\\`\${userInfo.id}\\\`\`, inline: true },
                            { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '📦 **Informasi Pesanan**', inline: false },
                            { name: 'Game', value: \`\\\`\${gameLink}\\\`\`, inline: true },
                            { name: 'Gamepass', value: \`\\\`\${gamepassName}\\\`\`, inline: true },
                            { name: 'Harga Gamepass', value: \`\\\`\${amount} Robux\\\`\`, inline: true },
                            { name: 'Total Pembayaran', value: \`\\\`Rp\${price.toLocaleString('id-ID')}\\\`\`, inline: true },
                            { name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: '\\u200b', inline: false }
                        )
                        .setThumbnail(userInfo.avatarUrl || 'https://tr.rbxcdn.com/default-headshot')
                        .setFooter({ text: 'Apabila seluruh informasi sudah sesuai, silakan tekan tombol Konfirmasi Pesanan.' })
                        .setColor('#f43f5e');

                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(\`confirm_order_\${sessionId}\`).setLabel('✅ Konfirmasi Pesanan').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(\`cancel_order_\${sessionId}\`).setLabel('✏️ Ubah Data').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setLabel('👤 Lihat Profil Roblox').setStyle(ButtonStyle.Link).setURL(\`https://www.roblox.com/users/\${userInfo.id}/profile\`)
                    );

                    return interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });
                } catch (err) {
                    logger.error('[InteractionCreate] Error submitting GIG modal:', err);
                    return interaction.editReply('❌ Terjadi kesalahan saat memproses pesanan.');
                }
            }`;

lines.splice(756, 1062 - 756 + 1, newCode);
fs.writeFileSync(path, lines.join('\n'));
console.log('Successfully replaced lines 757 to 1062 in interactionCreate.js');
