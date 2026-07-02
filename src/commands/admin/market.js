const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const marketplaceEngine    = require('../../services/marketplaceEngine');
const marketplaceSearch    = require('../../services/marketplaceSearch');
const marketplaceStatistics = require('../../services/marketplaceStatistics');
const TradeHistory         = require('../../models/TradeHistory');
const itemRegistry         = require('../../services/itemRegistry');
const { COLORS }           = require('../../utils/constants');

const RARITY_EMOJI = {
    Common: '⬜', Uncommon: '🟩', Rare: '🟦', Epic: '🟪', Legendary: '🟧', Mythic: '🟥'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market')
        .setDescription('Marketplace & Trading Platform')

        // ── browse ────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('browse')
                .setDescription('Jelajahi listing aktif di marketplace')
                .addStringOption(opt =>
                    opt.setName('sort')
                        .setDescription('Urutan tampilan')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Terbaru (default)', value: 'newest' },
                            { name: 'Terlama',           value: 'oldest' },
                            { name: 'Harga Terendah',    value: 'price_asc' },
                            { name: 'Harga Tertinggi',   value: 'price_desc' }
                        )
                )
        )

        // ── search ────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('search')
                .setDescription('Cari listing berdasarkan nama atau kategori item')
                .addStringOption(opt =>
                    opt.setName('query').setDescription('Kata kunci pencarian').setRequired(true)
                )
        )

        // ── sell ──────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Pasang item di marketplace (item masuk escrow)')
                .addStringOption(opt =>
                    opt.setName('item_id').setDescription('ID item yang ingin dijual').setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('price').setDescription('Harga per unit (coins)').setRequired(true).setMinValue(1)
                )
                .addIntegerOption(opt =>
                    opt.setName('qty').setDescription('Jumlah yang dijual (default: 1)').setRequired(false).setMinValue(1)
                )
        )

        // ── buy ───────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Beli listing dari marketplace')
                .addStringOption(opt =>
                    opt.setName('listing_id').setDescription('ID listing yang ingin dibeli (contoh: lst-xxx)').setRequired(true)
                )
        )

        // ── cancel ────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('cancel')
                .setDescription('Batalkan listing milikmu (item dikembalikan dari escrow)')
                .addStringOption(opt =>
                    opt.setName('listing_id').setDescription('ID listing yang ingin dibatalkan').setRequired(true)
                )
        )

        // ── history ───────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('history')
                .setDescription('Lihat 10 riwayat transaksi marketplace terakhirmu')
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // ── /market browse ────────────────────────────────────────────────────
        if (sub === 'browse') {
            const sort    = interaction.options.getString('sort') || 'newest';
            const results = await marketplaceSearch.browse(guildId, { sort, limit: 10 });

            const embed = new EmbedBuilder()
                .setTitle('🏪 Marketplace — Listing Aktif')
                .setColor(COLORS.DEFAULT)
                .setFooter({ text: `Diurutkan: ${sort} | Gunakan /market buy <listing_id> untuk membeli` })
                .setTimestamp();

            if (results.length === 0) {
                embed.setDescription('*Belum ada listing aktif di marketplace.*');
            } else {
                embed.setDescription(`Menampilkan **${results.length}** listing:`);
                for (const l of results) {
                    const icon  = l.item?.metadata?.icon ?? '📦';
                    const emoji = RARITY_EMOJI[l.item?.rarity] ?? '▫️';
                    embed.addFields({
                        name: `${emoji} ${icon} ${l.item?.name ?? l.itemId} × ${l.quantity}`,
                        value: `> ID: \`${l.listingId}\`\n> Harga: **${l.totalPrice.toLocaleString('id-ID')} coins** (${l.pricePerUnit}/unit)\n> Penjual: <@${l.sellerId}>`,
                        inline: false
                    });
                }
            }
            return interaction.editReply({ embeds: [embed] });
        }

        // ── /market search ────────────────────────────────────────────────────
        if (sub === 'search') {
            const query   = interaction.options.getString('query');
            const results = await marketplaceSearch.search(guildId, query);

            const embed = new EmbedBuilder()
                .setTitle(`🔍 Hasil Pencarian: "${query}"`)
                .setColor(COLORS.INFO)
                .setTimestamp();

            if (results.length === 0) {
                embed.setDescription(`*Tidak ada listing yang cocok dengan \`${query}\`.*`);
            } else {
                embed.setDescription(`Ditemukan **${results.length}** listing:`);
                for (const l of results.slice(0, 10)) {
                    const icon = l.item?.metadata?.icon ?? '📦';
                    embed.addFields({
                        name: `${icon} ${l.item?.name ?? l.itemId} × ${l.quantity}`,
                        value: `> \`${l.listingId}\` | **${l.totalPrice.toLocaleString('id-ID')} coins** | <@${l.sellerId}>`,
                        inline: false
                    });
                }
            }
            return interaction.editReply({ embeds: [embed] });
        }

        // ── /market sell ──────────────────────────────────────────────────────
        if (sub === 'sell') {
            const itemId = interaction.options.getString('item_id').trim().toLowerCase();
            const price  = interaction.options.getInteger('price');
            const qty    = interaction.options.getInteger('qty') || 1;

            const def = itemRegistry.get(itemId);
            if (!def) {
                return interaction.editReply(`❌ Item \`${itemId}\` tidak ditemukan di registry.`);
            }

            const result = await marketplaceEngine.sell(guildId, interaction.user.id, itemId, qty, price);
            if (!result.success) {
                return interaction.editReply(`❌ **Listing Gagal:** ${result.reason}`);
            }

            const icon = def.metadata?.icon ?? '📦';
            const embed = new EmbedBuilder()
                .setTitle(`${icon} Item Berhasil Dipasang!`)
                .setColor(COLORS.SUCCESS)
                .setDescription(`**${def.name}** berhasil dipasang di marketplace.\nItem telah dipindahkan ke **escrow** hingga terjual atau dibatalkan.`)
                .addFields(
                    { name: '🏷️ Listing ID', value: `\`${result.listing.listingId}\``, inline: true },
                    { name: '📦 Item',        value: `${icon} ${def.name} × ${qty}`,   inline: true },
                    { name: '💰 Harga',       value: `\`${result.listing.totalPrice.toLocaleString('id-ID')}\` coins (${price}/unit)`, inline: true }
                )
                .setFooter({ text: 'Gunakan /market cancel <listing_id> untuk membatalkan' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /market buy ───────────────────────────────────────────────────────
        if (sub === 'buy') {
            const listingId = interaction.options.getString('listing_id').trim();
            const result    = await marketplaceEngine.buy(guildId, interaction.user.id, listingId, {
                correlationId: `buy-${interaction.id}`
            });

            if (!result.success) {
                return interaction.editReply(`❌ **Pembelian Gagal:** ${result.reason}`);
            }

            const def  = itemRegistry.get(result.listing.itemId);
            const icon = def?.metadata?.icon ?? '📦';

            const embed = new EmbedBuilder()
                .setTitle('✅ Pembelian Berhasil!')
                .setColor(COLORS.SUCCESS)
                .addFields(
                    { name: '📦 Item Diterima',    value: `${icon} ${def?.name ?? result.listing.itemId} × ${result.listing.quantity}`, inline: true },
                    { name: '💰 Total Dibayar',    value: `\`${result.totalPrice.toLocaleString('id-ID')}\` coins`, inline: true },
                    { name: '🧾 Trade ID',         value: `\`${result.tradeId}\``, inline: true },
                    { name: '🏪 Penjual',          value: `<@${result.listing.sellerId}>`, inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /market cancel ────────────────────────────────────────────────────
        if (sub === 'cancel') {
            const listingId = interaction.options.getString('listing_id').trim();
            const result    = await marketplaceEngine.cancel(guildId, interaction.user.id, listingId);

            if (!result.success) {
                return interaction.editReply(`❌ **Pembatalan Gagal:** ${result.reason}`);
            }

            return interaction.editReply(`✅ **Listing Dibatalkan.**\nItem dari listing \`${listingId}\` telah dikembalikan ke inventory kamu.`);
        }

        // ── /market history ───────────────────────────────────────────────────
        if (sub === 'history') {
            const userId  = interaction.user.id;
            const trades  = await TradeHistory.find({
                guildId,
                $or: [{ sellerId: userId }, { buyerId: userId }]
            }).sort({ completedAt: -1 }).limit(10);

            const embed = new EmbedBuilder()
                .setTitle('📜 Riwayat Transaksi Marketplace')
                .setColor(COLORS.INFO)
                .setTimestamp();

            if (trades.length === 0) {
                embed.setDescription('*Belum ada riwayat transaksi.*');
            } else {
                embed.setDescription(`Menampilkan **${trades.length}** transaksi terakhir:`);
                for (const t of trades) {
                    const def    = itemRegistry.get(t.itemId);
                    const icon   = def?.metadata?.icon ?? '📦';
                    const isSell = t.sellerId === userId;
                    const sign   = isSell ? '🟢 Dijual' : '🔴 Dibeli';
                    const other  = isSell ? `<@${t.buyerId}>` : `<@${t.sellerId}>`;
                    embed.addFields({
                        name: `${sign} — ${icon} ${def?.name ?? t.itemId} × ${t.quantity}`,
                        value: `> Harga: \`${t.totalPrice.toLocaleString('id-ID')}\` coins | ${isSell ? 'Pembeli' : 'Penjual'}: ${other}\n> <t:${Math.round(new Date(t.completedAt).getTime() / 1000)}:R>`,
                        inline: false
                    });
                }
            }
            return interaction.editReply({ embeds: [embed] });
        }
    }
};
