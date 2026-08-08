const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src/events/interactionCreate.js');
let content = fs.readFileSync(targetPath, 'utf8');

if (!content.includes('const CopayEligibility = require')) {
    content = content.replace(
        "const Order = require('../models/Order');",
        "const Order = require('../models/Order');\nconst CopayEligibility = require('../models/CopayEligibility');"
    );
}

const copayHandlers = `
            // ==========================================
            // COPAY HANDLERS
            // ==========================================
            if (customId === 'copay_join_community') {
                const embed = new EmbedBuilder()
                    .setTitle('🌐 JOIN COMMUNITY ROBLOX')
                    .setDescription('Silakan klik link di bawah ini dan bergabung dengan **SELURUH** komunitas Roblox LyraBlox:\\n\\n1️⃣ [Community 1](https://www.roblox.com/share/g/628192083)\\n2️⃣ [Community 2](https://www.roblox.com/share/g/354576018)\\n3️⃣ [Community 3](https://www.roblox.com/share/g/196386723)\\n4️⃣ [Community 4](https://www.roblox.com/share/g/1061172752)\\n\\nJika Anda sudah bergabung ke seluruh grup di atas, klik tombol di bawah ini.')
                    .setColor('#3498db');
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('copay_verify_join').setLabel('✅ Saya Sudah Join').setStyle(ButtonStyle.Success)
                );
                
                return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }

            if (customId === 'copay_verify_join') {
                const modal = new ModalBuilder()
                    .setCustomId('copay_username_modal')
                    .setTitle('Konfirmasi Username');
                
                const usernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Username Roblox')
                    .setPlaceholder('Masukkan Username Roblox Anda...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
                return interaction.showModal(modal);
            }

            if (customId === 'copay_username_modal') {
                const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
                
                const embed = new EmbedBuilder()
                    .setDescription('━━━━━━━━━━━━━━━━━━━━━━\\n\\nTerima kasih telah bergabung ke Community Roblox LyraBlox.\\n\\nPastikan Anda telah bergabung ke **SELURUH** Community Roblox.\\n\\nApabila sudah yakin, tekan tombol di bawah untuk memulai masa tunggu Eligibility.\\n\\n━━━━━━━━━━━━━━━━━━━━━━')
                    .setColor('#f1c40f');
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('copay_start_timer_' + robloxUsername).setLabel('🚀 Mulai Perhitungan').setStyle(ButtonStyle.Primary)
                );
                
                try {
                    await interaction.user.send({ embeds: [embed], components: [row] });
                    return interaction.reply({ content: '✅ Silakan cek DM Anda untuk melanjutkan proses.', ephemeral: true });
                } catch (err) {
                    return interaction.reply({ content: '❌ Gagal mengirim DM. Pastikan setting DM Anda terbuka untuk server ini.', ephemeral: true });
                }
            }

            if (customId.startsWith('copay_start_timer_')) {
                const robloxUsername = customId.substring('copay_start_timer_'.length);
                const discordId = interaction.user.id;
                
                let doc = await CopayEligibility.findOne({ discordId });
                if (doc) {
                    return interaction.reply({ content: '❌ Timer Eligibility Anda sudah berjalan.', ephemeral: true });
                }

                const now = new Date();
                const eligibleAt = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days
                
                doc = new CopayEligibility({
                    discordId,
                    discordUsername: interaction.user.username,
                    robloxUsername,
                    startedAt: now,
                    eligibleAt
                });
                await doc.save();

                const unixStart = Math.floor(now.getTime() / 1000);
                const unixEligible = Math.floor(eligibleAt.getTime() / 1000);

                const embed = new EmbedBuilder()
                    .setTitle('⏳ ROBUX COMMUNITY ELIGIBILITY')
                    .setDescription(\`👤 **Roblox Username**\\n\${robloxUsername}\\n\\n📅 **Mulai Perhitungan**\\n<t:\${unixStart}:F> (<t:\${unixStart}:R>)\\n\\n🎯 **Eligible Pada**\\n<t:\${unixEligible}:F> (<t:\${unixEligible}:R>)\\n\\n━━━━━━━━━━━━━━━━━━━━━━\n**Progress**\nStatus: 🟡 Waiting\nProgress: 0 / 14 Hari\`)
                    .setColor('#f1c40f')
                    .setFooter({ text: 'Bot akan memberi tahu Anda secara otomatis ketika telah memenuhi syarat.' });
                
                await interaction.update({ embeds: [embed], components: [] });
                return;
            }

            if (customId === 'copay_order_now') {
                const doc = await CopayEligibility.findOne({ discordId: interaction.user.id });
                if (!doc || doc.status !== 'eligible') {
                    const embed = new EmbedBuilder()
                        .setDescription('❌ **Anda belum memenuhi syarat.**\\n\\nSilakan bergabung ke seluruh Community Roblox dan tunggu hingga masa Eligibility selesai.')
                        .setColor('#e74c3c');
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                // Follow standard ticket flow for Copay packages
                const packages = await RobuxPackage.find({ type: 'copay', enabled: true }).sort({ sortOrder: 1, amount: 1 });
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
                            .setLabel(\`\${pkg.amount} Robux\`)
                            .setDescription(\`Harga: Rp \${pkg.price.toLocaleString('id-ID')}\`)
                            .setValue(pkg._id.toString())
                    );
                });

                const row = new ActionRowBuilder().addComponents(selectMenu);
                return interaction.reply({ content: 'Silakan pilih paket Community Payout yang ingin Anda beli:', components: [row], ephemeral: true });
            }

            if (customId === 'copay_select_package') {
                const packageId = interaction.values[0];
                const pkg = await RobuxPackage.findById(packageId);
                if (!pkg) return interaction.reply({ content: 'Paket tidak ditemukan.', ephemeral: true });

                const modal = new ModalBuilder()
                    .setCustomId(\`copay_modal_order:\${packageId}\`)
                    .setTitle('Konfirmasi Pesanan');
                
                const robloxUsernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Username Roblox Tujuan')
                    .setPlaceholder('Masukkan Username Roblox...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                // Assuming CopayEligibility has their username, we can prefill if we wanted, but standard ticket flow is fine
                modal.addComponents(new ActionRowBuilder().addComponents(robloxUsernameInput));
                return await interaction.showModal(modal);
            }

            if (customId.startsWith('copay_modal_order:')) {
                const packageId = customId.split(':')[1];
                const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
                
                const pkg = await RobuxPackage.findById(packageId);
                if (!pkg) return interaction.reply({ content: 'Paket tidak ditemukan.', ephemeral: true });

                const { createTicket } = require('../services/ticketService');
                
                await interaction.deferReply({ ephemeral: true });
                try {
                    const ticketResult = await createTicket(interaction, 'copay', pkg, robloxUsername);
                    return interaction.editReply({ content: ticketResult.message });
                } catch (err) {
                    return interaction.editReply({ content: '❌ Gagal membuat ticket. Silakan coba lagi nanti.' });
                }
            }
            // ==========================================
`;

if (!content.includes("customId === 'copay_join_community'")) {
    content = content.replace(
        "if (customId === 'vilog_order_now') {",
        copayHandlers + "\n            if (customId === 'vilog_order_now') {"
    );
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Patch complete.');
