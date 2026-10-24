const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pricelistService = require('../../services/pricelistService');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pricelist')
        .setDescription('Kelola dan publikasikan panel daftar harga gamepass (Admin Only).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('menu')
                .setDescription('Buka panel kontrol interaktif untuk mengelola kategori dan item gamepass.')
        )
        .addSubcommand(sub =>
            sub.setName('publish')
                .setDescription('Kirim atau perbarui panel daftar harga ke channel pricelist.')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel tujuan (default: 1562746683081752648)')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'menu') {
            await interaction.deferReply({ ephemeral: true });
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

            return interaction.editReply({ embeds: [embed], components: [row1, row2] });
        }

        if (subcommand === 'publish') {
            await interaction.deferReply({ ephemeral: true });
            const targetChannel = interaction.options.getChannel('channel') || { id: '1562746683081752648' };

            try {
                const res = await pricelistService.publishPanel(interaction.client, targetChannel.id);
                return interaction.editReply(`✅ Panel Pricelist Gamepass berhasil dikirim / diperbarui ke <#${res.channelId}>!`);
            } catch (err) {
                logger.error('[PricelistCommand] Error publishing:', err);
                return interaction.editReply(`❌ Gagal mengirim panel: ${err.message}`);
            }
        }
    }
};
