const fs = require('fs');
const path = 'src/events/interactionCreate.js';

let content = fs.readFileSync(path, 'utf8');

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

                return await interaction.showModal(modal);
            }`;

content = content.replace("            // Dynamic Product Buy Button", continueVilogCode + "\n" + continueVisendCode + "\n" + continueGigCode + "\n\n            // Dynamic Product Buy Button");

fs.writeFileSync(path, content);
console.log('Successfully injected continue handlers');
