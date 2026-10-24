const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const pricelistService = require('../services/pricelistService');
const logger = require('../utils/logger');

class PricelistInteractionHandler {
    isAdmin(interaction) {
        const member = interaction.member;
        const isOwner = interaction.guild?.ownerId === interaction.user.id;
        const hasAdmin = member?.permissions?.has('Administrator');
        return isOwner || hasAdmin;
    }

    /**
     * Handle button clicks
     */
    async handleButton(interaction) {
        const { customId } = interaction;

        // Member clicks button on the public pricelist panel in channel 1562746683081752648
        if (customId.startsWith('pricelist_view_')) {
            const categoryId = customId.replace('pricelist_view_', '');
            const category = await pricelistService.getCategory(categoryId);
            if (!category) {
                return interaction.reply({ content: '❌ Kategori pricelist tidak ditemukan atau sudah dihapus.', ephemeral: true });
            }
            const embed = await pricelistService.buildCategoryEmbed(category);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Admin: Open Dashboard Pricelist Menu
        if (customId === 'dashboard_menu_pricelist') {
            if (!this.isAdmin(interaction)) {
                return interaction.reply({ content: '❌ Anda tidak memiliki izin untuk mengakses menu ini.', ephemeral: true });
            }

            const categories = await pricelistService.getAllCategories();
            const rate = await pricelistService.getRate();

            let catList = categories.map((c, i) => `${i + 1}. **${c.buttonEmoji ? c.buttonEmoji + ' ' : ''}${c.buttonLabel}** — \`${c.items.length} Gamepass\``).join('\n') || '*Belum ada kategori / tombol yang dibuat.*';

            const embed = new EmbedBuilder()
                .setTitle('📋 Kelola Pricelist Gamepass (Admin Control)')
                .setDescription(
                    `Menu pengaturan daftar harga gamepass dan tombol kategori yang tampil di channel <#1562746683081752648>.\n\n` +
                    `⚡ **Rate Bot Saat Ini:** \`Rp ${rate} / Robux\` *(Harga otomatis dihitung dari rate)*\n\n` +
                    `📁 **Daftar Kategori / Tombol Aktif:**\n${catList}\n\n` +
                    `Silakan gunakan tombol di bawah untuk menambah kategori, memasukkan item gamepass, atau mengirim panel ke channel.`
                )
                .setColor('#3b82f6');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pricelist_admin_add_cat').setLabel('➕ Tambah Tombol Kategori').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('pricelist_admin_manage_items').setLabel('📝 Kelola Item Gamepass').setStyle(ButtonStyle.Primary).setDisabled(categories.length === 0),
                new ButtonBuilder().setCustomId('pricelist_admin_del_cat').setLabel('🗑️ Hapus Kategori').setStyle(ButtonStyle.Danger).setDisabled(categories.length === 0)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pricelist_admin_publish').setLabel('🚀 Kirim / Perbarui Panel ke Channel').setStyle(ButtonStyle.Secondary)
            );

            if (interaction.replied || interaction.deferred) {
                return interaction.editReply({ embeds: [embed], components: [row1, row2] });
            }
            return interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
        }

        // Admin: Open modal to add category
        if (customId === 'pricelist_admin_add_cat') {
            if (!this.isAdmin(interaction)) {
                return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('modal_pricelist_create_cat')
                .setTitle('Tambah Tombol Kategori Baru');

            const labelInput = new TextInputBuilder()
                .setCustomId('input_cat_label')
                .setLabel('Label Tombol (contoh: Blox Fruits)')
                .setPlaceholder('Nama kategori yang muncul pada tombol')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(50)
                .setRequired(true);

            const emojiInput = new TextInputBuilder()
                .setCustomId('input_cat_emoji')
                .setLabel('Emoji Tombol (contoh: ⚔️)')
                .setPlaceholder('Opsional, kosongkan jika tidak ingin emoji')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(10)
                .setRequired(false);

            const titleInput = new TextInputBuilder()
                .setCustomId('input_cat_title')
                .setLabel('Judul Embed (contoh: Pricelist Blox Fruits)')
                .setPlaceholder('Judul daftar harga saat tombol dipencet')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setRequired(true);

            const descInput = new TextInputBuilder()
                .setCustomId('input_cat_desc')
                .setLabel('Deskripsi / Catatan Tambahan (Opsional)')
                .setPlaceholder('Catatan atau informasi tambahan...')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(500)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(labelInput),
                new ActionRowBuilder().addComponents(emojiInput),
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descInput)
            );

            return await interaction.showModal(modal);
        }

        // Admin: Select category to manage items
        if (customId === 'pricelist_admin_manage_items') {
            if (!this.isAdmin(interaction)) {
                return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
            }

            const categories = await pricelistService.getAllCategories();
            if (categories.length === 0) {
                return interaction.reply({ content: '⚠️ Belum ada kategori. Silakan buat kategori terlebih dahulu.', ephemeral: true });
            }

            const options = categories.map((cat, i) => ({
                label: `${i + 1}. ${cat.buttonLabel}`.substring(0, 100),
                description: `${cat.items.length} item gamepass • ID: ${cat.categoryId}`.substring(0, 100),
                value: cat.categoryId,
                emoji: cat.buttonEmoji || '📋'
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_pricelist_cat_for_items')
                .setPlaceholder('Pilih kategori gamepass yang ingin dikelola...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ content: '👇 Silakan pilih kategori gamepass yang ingin Anda tambahkan / hapus itemnya:', components: [row], ephemeral: true });
        }

        // Admin: Open modal to add item to specific category
        if (customId.startsWith('pricelist_admin_open_add_item_')) {
            if (!this.isAdmin(interaction)) {
                return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
            }

            const catId = customId.replace('pricelist_admin_open_add_item_', '');
            const category = await pricelistService.getCategory(catId);
            if (!category) {
                return interaction.reply({ content: '❌ Kategori tidak ditemukan.', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_pricelist_add_item_${catId}`)
                .setTitle(`Tambah Item (${category.buttonLabel})`.substring(0, 45));

            const nameInput = new TextInputBuilder()
                .setCustomId('input_item_name')
                .setLabel('Nama Gamepass (contoh: 2x Money)')
                .setPlaceholder('Masukkan nama gamepass...')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(100)
                .setRequired(true);

            const robuxInput = new TextInputBuilder()
                .setCustomId('input_item_robux')
                .setLabel('Jumlah Robux (contoh: 450)')
                .setPlaceholder('Hanya angka, harga Rupiah dihitung otomatis')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(15)
                .setRequired(true);

            const customPriceInput = new TextInputBuilder()
                .setCustomId('input_item_custom_price')
                .setLabel('Harga Manual / Custom (Opsional)')
                .setPlaceholder('Kosongkan untuk otomatis dihitung dari rate bot')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(15)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(robuxInput),
                new ActionRowBuilder().addComponents(customPriceInput)
            );

            return await interaction.showModal(modal);
        }

        // Admin: Open menu to delete item from category
        if (customId.startsWith('pricelist_admin_open_del_item_')) {
            if (!this.isAdmin(interaction)) {
                return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
            }

            const catId = customId.replace('pricelist_admin_open_del_item_', '');
            const category = await pricelistService.getCategory(catId);
            if (!category || !category.items || category.items.length === 0) {
                return interaction.reply({ content: 'ℹ️ Tidak ada gamepass di kategori ini.', ephemeral: true });
            }

            const rate = await pricelistService.getRate();
            const options = category.items.map((item, idx) => {
                const price = pricelistService.calculatePrice(item.robux, rate, item.customPrice);
                return {
                    label: `${idx + 1}. ${item.name}`.substring(0, 100),
                    description: `${item.robux} Robux • Rp ${price.toLocaleString('id-ID')}`.substring(0, 100),
                    value: idx.toString()
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`select_pricelist_remove_item_${catId}`)
                .setPlaceholder('Pilih gamepass yang ingin dihapus...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ content: `Pilih gamepass yang ingin dihapus dari kategori **${category.buttonLabel}**:`, components: [row], ephemeral: true });
        }

        // Admin: Open menu to delete category
        if (customId === 'pricelist_admin_del_cat') {
            if (!this.isAdmin(interaction)) {
                return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
            }

            const categories = await pricelistService.getAllCategories();
            if (categories.length === 0) {
                return interaction.reply({ content: 'ℹ️ Tidak ada kategori yang bisa dihapus.', ephemeral: true });
            }

            const options = categories.map((cat, i) => ({
                label: `${i + 1}. ${cat.buttonLabel}`.substring(0, 100),
                description: `${cat.items.length} item • ID: ${cat.categoryId}`.substring(0, 100),
                value: cat.categoryId,
                emoji: cat.buttonEmoji || '🗑️'
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_pricelist_delete_category')
                .setPlaceholder('Pilih kategori yang ingin dihapus permanen...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ content: '⚠️ **Pilih kategori / tombol yang ingin dihapus:**', components: [row], ephemeral: true });
        }

        // Admin: Publish / Sync Panel to channel 1562746683081752648
        if (customId === 'pricelist_admin_publish') {
            if (!this.isAdmin(interaction)) {
                return interaction.reply({ content: '❌ Anda tidak memiliki izin.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            try {
                const res = await pricelistService.publishPanel(interaction.client, '1562746683081752648');
                return interaction.editReply(`✅ Panel Pricelist berhasil dipublikasikan / diperbarui di <#${res.channelId}>!`);
            } catch (err) {
                logger.error('[PricelistHandler] Error publishing panel:', err);
                return interaction.editReply(`❌ Gagal mempublikasikan panel: ${err.message}`);
            }
        }
    }

    /**
     * Handle select menus
     */
    async handleSelectMenu(interaction) {
        const { customId, values } = interaction;

        // Admin selects a category to manage its gamepasses
        if (customId === 'select_pricelist_cat_for_items') {
            const catId = values[0];
            const category = await pricelistService.getCategory(catId);
            if (!category) {
                return interaction.update({ content: '❌ Kategori tidak ditemukan.', components: [] });
            }

            const rate = await pricelistService.getRate();
            let itemsText = '';
            if (category.items && category.items.length > 0) {
                category.items.forEach((item, i) => {
                    const price = pricelistService.calculatePrice(item.robux, rate, item.customPrice);
                    itemsText += `**${i + 1}. ${item.name}** — \`${item.robux.toLocaleString('id-ID')} Robux\` ➔ \`Rp ${price.toLocaleString('id-ID')}\`\n`;
                });
            } else {
                itemsText = '*Belum ada gamepass di kategori ini.*';
            }

            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Kelola Gamepass: ${category.buttonEmoji ? category.buttonEmoji + ' ' : ''}${category.buttonLabel}`)
                .setDescription(
                    `Rate bot aktif: \`Rp ${rate} / Robux\`\n\n` +
                    `📦 **Daftar Gamepass Saat Ini:**\n${itemsText}\n\n` +
                    `Pilih aksi di bawah ini untuk menambah atau menghapus gamepass:`
                )
                .setColor('#3b82f6');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`pricelist_admin_open_add_item_${catId}`).setLabel('➕ Tambah Gamepass').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`pricelist_admin_open_del_item_${catId}`).setLabel('🗑️ Hapus Gamepass').setStyle(ButtonStyle.Danger).setDisabled(!category.items || category.items.length === 0),
                new ButtonBuilder().setCustomId('dashboard_menu_pricelist').setLabel('🔙 Kembali ke Menu').setStyle(ButtonStyle.Secondary)
            );

            return await interaction.update({ content: null, embeds: [embed], components: [row] });
        }

        // Admin removes an item from category
        if (customId.startsWith('select_pricelist_remove_item_')) {
            const catId = customId.replace('select_pricelist_remove_item_', '');
            const itemIndex = parseInt(values[0]);

            const category = await pricelistService.removeItem(catId, itemIndex);

            // Auto-update live panel
            pricelistService.publishPanel(interaction.client, '1562746683081752648').catch(() => {});

            return await interaction.update({
                content: `✅ Gamepass berhasil dihapus dari kategori **${category.buttonLabel}**! Panel live telah diperbarui secara otomatis.`,
                components: []
            });
        }

        // Admin deletes an entire category
        if (customId === 'select_pricelist_delete_category') {
            const catId = values[0];
            const deleted = await pricelistService.deleteCategory(catId);

            // Auto-update live panel
            pricelistService.publishPanel(interaction.client, '1562746683081752648').catch(() => {});

            return await interaction.update({
                content: `✅ Kategori **${deleted?.buttonLabel || catId}** berhasil dihapus permanen! Panel live telah diperbarui secara otomatis.`,
                components: []
            });
        }
    }

    /**
     * Handle modal submissions
     */
    async handleModalSubmit(interaction) {
        const { customId } = interaction;

        // Admin submits new category creation
        if (customId === 'modal_pricelist_create_cat') {
            await interaction.deferReply({ ephemeral: true });

            const buttonLabel = interaction.fields.getTextInputValue('input_cat_label').trim();
            const buttonEmoji = interaction.fields.getTextInputValue('input_cat_emoji').trim() || '📋';
            const title = interaction.fields.getTextInputValue('input_cat_title').trim();
            const description = interaction.fields.getTextInputValue('input_cat_desc').trim();

            const newCat = await pricelistService.createCategory({
                buttonLabel,
                buttonEmoji,
                title,
                description
            });

            // Auto-update live panel
            pricelistService.publishPanel(interaction.client, '1562746683081752648').catch(() => {});

            const nextRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`pricelist_admin_open_add_item_${newCat.categoryId}`).setLabel('➕ Langsung Tambah Gamepass').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('dashboard_menu_pricelist').setLabel('🔙 Menu Pricelist').setStyle(ButtonStyle.Secondary)
            );

            return interaction.editReply({
                content: `✅ Tombol kategori **${newCat.buttonEmoji} ${newCat.buttonLabel}** berhasil dibuat!\nTombol otomatis ditambahkan ke panel live <#1562746683081752648>.`,
                components: [nextRow]
            });
        }

        // Admin submits new item to category
        if (customId.startsWith('modal_pricelist_add_item_')) {
            await interaction.deferReply({ ephemeral: true });

            const catId = customId.replace('modal_pricelist_add_item_', '');
            const name = interaction.fields.getTextInputValue('input_item_name').trim();
            const robuxStr = interaction.fields.getTextInputValue('input_item_robux').replace(/[^0-9]/g, '');
            const customPriceStr = interaction.fields.getTextInputValue('input_item_custom_price').replace(/[^0-9]/g, '');

            const robux = parseInt(robuxStr) || 0;
            if (robux <= 0) {
                return interaction.editReply('❌ Jumlah Robux harus berupa angka lebih besar dari 0.');
            }

            const customPrice = customPriceStr ? (parseInt(customPriceStr) || null) : null;
            const updatedCat = await pricelistService.addItem(catId, { name, robux, customPrice });

            const rate = await pricelistService.getRate();
            const finalPrice = pricelistService.calculatePrice(robux, rate, customPrice);

            // Auto-update live panel
            pricelistService.publishPanel(interaction.client, '1562746683081752648').catch(() => {});

            const nextRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`pricelist_admin_open_add_item_${catId}`).setLabel('➕ Tambah Gamepass Lainnya').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('dashboard_menu_pricelist').setLabel('🔙 Menu Pricelist').setStyle(ButtonStyle.Secondary)
            );

            return interaction.editReply({
                content: `✅ Berhasil menambahkan Gamepass ke **${updatedCat.buttonLabel}**!\n\n` +
                         `• **Nama:** \`${name}\`\n` +
                         `• **Robux:** \`${robux.toLocaleString('id-ID')} Robux\`\n` +
                         `• **Harga Otomatis:** \`Rp ${finalPrice.toLocaleString('id-ID')}\` *(Rate Rp ${rate})*\n\n` +
                         `Panel live di <#1562746683081752648> telah diperbarui secara otomatis.`,
                components: [nextRow]
            });
        }
    }
}

module.exports = new PricelistInteractionHandler();
