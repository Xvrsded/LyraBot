const fs = require('fs');
const path = 'src/events/interactionCreate.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Add StoreService imports
content = content.replace("const { getRobloxUserInfo } = require('../services/robloxService');", "const { getRobloxUserInfo } = require('../services/robloxService');\nconst { getStoreSetting, updateStoreStatus, buildDashboardMessage } = require('../services/storeService');");

// 2. Add Dashboard button logic at the beginning of isButton (around line 134)
const dashboardLogic = `            // Dashboard Button Control
            if (customId === 'dashboard_open' || customId === 'dashboard_busy' || customId === 'dashboard_closed') {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (!member.permissions.has('Administrator')) {
                    return interaction.reply({ content: '❌ Anda tidak memiliki izin untuk mengelola Dashboard.', ephemeral: true });
                }

                await interaction.deferUpdate();
                const newStatus = customId.split('_')[1];
                await updateStoreStatus(newStatus, interaction.user.username);
                
                const newDashboard = await buildDashboardMessage(interaction.client);
                await interaction.editReply({ embeds: newDashboard.embeds, components: newDashboard.components });
                return;
            }

            // Cancel Busy Warn
            if (customId === 'cancel_order_warn') {
                return interaction.update({ content: '❌ Pesanan dibatalkan.', embeds: [], components: [] });
            }

            // Centralized Order Handler Logic
            const handleOrderClick = async (type) => {
                const setting = await getStoreSetting();
                if (setting.status === 'closed') {
                    return interaction.reply({
                        content: '🔴 **Store Sedang Tutup**\\nMohon maaf.\\nSaat ini LyraBlox sedang tidak menerima pesanan.\\nSilakan kembali lagi ketika Store telah dibuka.\\nTerima kasih atas pengertiannya.',
                        ephemeral: true
                    });
                }
                
                if (setting.status === 'busy') {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(\`continue_order_\${type}\`).setLabel('Lanjutkan').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('cancel_order_warn').setLabel('Batal').setStyle(ButtonStyle.Danger)
                    );
                    return interaction.reply({
                        content: '⚠️ **LyraBlox sedang ramai.**\\nEstimasi proses pesanan sedikit lebih lama dari biasanya.\\nPerkiraan waktu proses:\\n15–30 Menit.\\n\\nApakah Anda tetap ingin melanjutkan?',
                        ephemeral: true,
                        components: [row]
                    });
                }
                
                return 'proceed'; // Let the code proceed
            };
`;

content = content.replace("            // Static Verification Button", dashboardLogic + "            // Static Verification Button");

// 3. Inject handleOrderClick in vilog_order_now
const vilogPattern = /if \(customId === 'vilog_order_now'\) {\s+try {/;
content = content.replace(vilogPattern, `if (customId === 'vilog_order_now') {
                const check = await handleOrderClick('vilog');
                if (check !== 'proceed') return;
                try {`);

// 4. Inject handleOrderClick in visend_order_now
const visendPattern = /if \(customId === 'visend_order_now'\) {\s+try {/;
content = content.replace(visendPattern, `if (customId === 'visend_order_now') {
                const check = await handleOrderClick('visend');
                if (check !== 'proceed') return;
                try {`);

// 5. Inject handleOrderClick in gig_order_now
const gigPattern = /if \(customId === 'gig_order_now'\) {\s+const modal = new ModalBuilder\(\)/;
content = content.replace(gigPattern, `if (customId === 'gig_order_now') {
                const check = await handleOrderClick('gig');
                if (check !== 'proceed') return;
                const modal = new ModalBuilder()`);


// 6. Duplicate logic for continue_order buttons
// We will simply replicate the original logic inside continue_order_xxx
const continueVilogCode = `            if (customId === 'continue_order_vilog') {
                try {
                    const packages = await RobuxPackage.find({ type: 'vilog', enabled: true }).sort({ sortOrder: 1, amount: 1 });
                    if (packages.length === 0) {
                        return interaction.reply({ content: '❌ Saat ini belum ada paket Robux Vilog yang aktif di database.', ephemeral: true });
                    }

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('vilog_select_package')
                        .setPlaceholder('Pilih Paket Robux');

                    packages.forEach(pkg => {
                        select.addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(\`\${pkg.amount.toLocaleString('id-ID')} Robux\`)
                                .setDescription(\`Harga: Rp \${pkg.price.toLocaleString('id-ID')}\`)
                                .setValue(\`\${pkg.amount}:\${pkg.price}\`)
                        );
                    });

                    const row = new ActionRowBuilder().addComponents(select);
                    return await interaction.update({ content: 'Silakan pilih paket Robux yang ingin Anda beli:', components: [row], ephemeral: true });
                } catch (err) {
                    logger.error('[InteractionCreate] Error loading Vilog packages:', err);
                    return interaction.reply({ content: '❌ Gagal memuat daftar paket Robux.', ephemeral: true });
                }
            }`;

const continueVisendCode = `            if (customId === 'continue_order_visend') {
                try {
                    const packages = await RobuxPackage.find({ type: 'visend', enabled: true }).sort({ sortOrder: 1, amount: 1 });
                    if (packages.length === 0) {
                        return interaction.reply({ content: '❌ Saat ini belum ada paket Robux Visend yang aktif di database.', ephemeral: true });
                    }

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('visend_select_package')
                        .setPlaceholder('Pilih Paket Robux');

                    select.addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('✨ Custom Robux')
                            .setDescription('Tentukan jumlah Robux yang Anda inginkan')
                            .setValue('custom:0'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('━━━━━━━━━━━━━━')
                            .setDescription('Daftar Paket Reguler')
                            .setValue('divider:0')
                    );

                    packages.forEach(pkg => {
                        select.addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(\`\${pkg.amount.toLocaleString('id-ID')} Robux\`)
                                .setDescription(\`Harga: Rp \${pkg.price.toLocaleString('id-ID')}\`)
                                .setValue(\`\${pkg.amount}:\${pkg.price}\`)
                        );
                    });

                    const row = new ActionRowBuilder().addComponents(select);
                    return await interaction.update({ content: 'Silakan pilih paket Robux yang ingin Anda beli:', components: [row], ephemeral: true });
                } catch (err) {
                    logger.error('[InteractionCreate] Error loading Visend packages:', err);
                    return interaction.reply({ content: '❌ Gagal memuat daftar paket Robux.', ephemeral: true });
                }
            }`;

const continueGigCode = `            if (customId === 'continue_order_gig') {
                const modal = new ModalBuilder()
                    .setCustomId('gig_modal_order')
                    .setTitle('Order Gift In Game');

                const gameLinkInput = new TextInputBuilder()
                    .setCustomId('gig_game_link')
                    .setLabel('Link Game Roblox')
                    .setPlaceholder('https://www.roblox.com/games/xxxxx')
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

                // Because this is from a button interaction that hasn't been deferred/replied yet (actually it is an interaction.update? NO, interaction.showModal works as long as we haven't deferred). 
                // Wait! In handleOrderClick, I replied with ephemeral. So the "continue" button is on an ephemeral message.
                // Clicking the continue button fires a NEW interaction. So interaction.showModal(modal) is PERFECTLY VALID here!
                return await interaction.showModal(modal);
            }`;

// Inject continue codes after GIG button trigger block
// Find the end of gig_order_now block
content = content.replace("            // Verify Account Flow (Check Eligibility)", continueVilogCode + "\n" + continueVisendCode + "\n" + continueGigCode + "\n\n            // Verify Account Flow (Check Eligibility)");

fs.writeFileSync(path, content);
console.log('Successfully injected dashboard and order intercept logic into interactionCreate.js');
