const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const itemRegistry       = require('../../services/itemRegistry');
const inventoryService   = require('../../services/inventoryService');
const inventoryEngine    = require('../../services/inventoryEngine');
const itemUsagePipeline  = require('../../services/itemUsagePipeline');
const inventoryStatistics = require('../../services/inventoryStatistics');
const { COLORS }         = require('../../utils/constants');

// Rarity color map for embed accents
const RARITY_COLORS = {
    Common:    '#aaaaaa',
    Uncommon:  '#2ecc71',
    Rare:      '#3498db',
    Epic:      '#9b59b6',
    Legendary: '#f39c12',
    Mythic:    '#e74c3c'
};

// Rarity emoji
const RARITY_EMOJI = {
    Common:    '⬜',
    Uncommon:  '🟩',
    Rare:      '🟦',
    Epic:      '🟪',
    Legendary: '🟧',
    Mythic:    '🟥'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Sistem Inventory & Item')

        // ── view ──────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('Tampilkan inventory kamu atau member lain')
                .addUserOption(opt =>
                    opt.setName('member').setDescription('Member yang ingin dilihat inventorynya').setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('sort')
                        .setDescription('Urutkan berdasarkan')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Rarity (default)', value: 'rarity' },
                            { name: 'Nama',             value: 'name' },
                            { name: 'Jumlah',           value: 'quantity' },
                            { name: 'Kategori',         value: 'category' },
                            { name: 'Diperoleh',        value: 'acquiredAt' }
                        )
                )
        )

        // ── use ───────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('use')
                .setDescription('Gunakan item dari inventory kamu')
                .addStringOption(opt =>
                    opt.setName('item_id').setDescription('ID item yang akan digunakan').setRequired(true)
                )
        )

        // ── inspect ───────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('inspect')
                .setDescription('Lihat detail lengkap sebuah item')
                .addStringOption(opt =>
                    opt.setName('item_id').setDescription('ID item yang ingin diinspeksi').setRequired(true)
                )
        )

        // ── search ────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('search')
                .setDescription('Cari item di inventory kamu berdasarkan nama atau kategori')
                .addStringOption(opt =>
                    opt.setName('query').setDescription('Kata kunci pencarian').setRequired(true)
                )
        )

        // ── stats ─────────────────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('Tampilkan statistik inventory server')
        ),

    /**
     * @param {ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // ── /inventory view ───────────────────────────────────────────────────
        if (sub === 'view') {
            const target   = interaction.options.getUser('member') || interaction.user;
            const sortMode = interaction.options.getString('sort') || 'rarity';

            const sorted = await inventoryEngine.sort(guildId, target.id, sortMode);
            const slotCount = sorted.length;

            const embed = new EmbedBuilder()
                .setTitle(`🎒 Inventory — ${target.username}`)
                .setDescription(slotCount === 0 ? '*Inventory kosong.*' : `Menampilkan **${slotCount}** item (diurutkan: \`${sortMode}\`)`)
                .setColor(COLORS.DEFAULT)
                .setFooter({ text: `Slot: ${slotCount}/100` })
                .setTimestamp();

            // Display up to 15 items per embed (Discord limit ~25 fields)
            const page = sorted.slice(0, 15);
            for (const { slot, item } of page) {
                const rarityEmoji = RARITY_EMOJI[item?.rarity] ?? '▫️';
                const icon        = item?.metadata?.icon ?? '📦';
                embed.addFields({
                    name: `${rarityEmoji} ${icon} ${item?.name ?? slot.itemId}`,
                    value: `> Kategori: \`${item?.category ?? '?'}\` | Rarity: \`${item?.rarity ?? '?'}\`\n> Jumlah: **${slot.quantity}**${item?.usable ? ' | ✅ Dapat digunakan' : ''}`,
                    inline: false
                });
            }

            if (slotCount > 15) {
                embed.addFields({ name: '...', value: `*Dan ${slotCount - 15} item lainnya.*`, inline: false });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /inventory use ────────────────────────────────────────────────────
        if (sub === 'use') {
            const itemId = interaction.options.getString('item_id').trim().toLowerCase();
            const result = await itemUsagePipeline.use(guildId, interaction.user.id, itemId, {
                client: interaction.client,
                correlationId: `use-${interaction.id}`
            });

            if (!result.success) {
                return interaction.editReply(`❌ **Gagal:** ${result.reason}`);
            }

            const icon = result.item?.metadata?.icon ?? '📦';
            const rarityColor = RARITY_COLORS[result.item?.rarity] ?? COLORS.DEFAULT;

            const embed = new EmbedBuilder()
                .setTitle(`${icon} Item Digunakan: ${result.item.name}`)
                .setColor(rarityColor)
                .setDescription(`Kamu berhasil menggunakan **${result.item.name}**.`)
                .setTimestamp();

            if (result.applied.length > 0) {
                const effectLines = result.applied.map(e => {
                    if (e.type === 'coins')      return `• 🪙 +${e.amount} ${e.currency ?? 'coins'}`;
                    if (e.type === 'xp')         return `• ✨ +${e.amount} XP`;
                    if (e.type === 'role')        return `• 🎭 Role diberikan`;
                    if (e.type === 'loot_table')  return `• 📦 Loot table \`${e.tableId}\` digulir`;
                    if (e.type === 'custom')      return `• ⚡ Custom event: \`${e.event}\``;
                    return `• ${e.type}`;
                }).join('\n');
                embed.addFields({ name: '✅ Efek Diterapkan', value: effectLines, inline: false });
            }

            if (result.failed.length > 0) {
                embed.addFields({
                    name: '⚠️ Efek Gagal',
                    value: result.failed.map(e => `• ${e.type}: ${e.error}`).join('\n'),
                    inline: false
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /inventory inspect ────────────────────────────────────────────────
        if (sub === 'inspect') {
            const itemId = interaction.options.getString('item_id').trim().toLowerCase();
            const def    = itemRegistry.get(itemId);

            if (!def) {
                return interaction.editReply(`❌ Item dengan ID \`${itemId}\` tidak ditemukan di registry.`);
            }

            const rarityColor = RARITY_COLORS[def.rarity] ?? COLORS.DEFAULT;
            const icon        = def.metadata?.icon ?? '📦';

            const traits = [
                def.stackable  ? `Stackable (maks: ${def.maxStack})`    : 'Tidak Stackable',
                def.tradable   ? '✅ Dapat diperdagangkan'              : '❌ Tidak dapat diperdagangkan',
                def.sellable   ? '✅ Dapat dijual'                      : '❌ Tidak dapat dijual',
                def.droppable  ? '✅ Dapat di-drop'                     : '❌ Tidak dapat di-drop',
                def.usable     ? '✅ Dapat digunakan'                   : '❌ Tidak dapat digunakan'
            ];

            const effectText = def.effects.length > 0
                ? def.effects.map(e => {
                    if (e.type === 'coins')      return `🪙 +${e.amount} ${e.currency ?? 'coins'}`;
                    if (e.type === 'xp')         return `✨ +${e.amount} XP`;
                    if (e.type === 'role')        return `🎭 Berikan role \`${e.roleId}\``;
                    if (e.type === 'loot_table')  return `📦 Guling table \`${e.tableId}\``;
                    if (e.type === 'custom')      return `⚡ Custom: \`${e.event}\``;
                    return e.type;
                }).join('\n')
                : '*Tidak ada efek*';

            // Check if user owns it
            const owned = await inventoryService.get(guildId, interaction.user.id, itemId);

            const embed = new EmbedBuilder()
                .setTitle(`${icon} ${def.name}`)
                .setColor(rarityColor)
                .setDescription(def.description)
                .addFields(
                    { name: '🏷️ Rarity',   value: `${RARITY_EMOJI[def.rarity] ?? '▫️'} ${def.rarity}`, inline: true },
                    { name: '📁 Kategori', value: def.category,                                          inline: true },
                    { name: '🎒 Kamu Punya', value: owned ? `\`${owned.quantity}\` buah` : '*Tidak dimiliki*', inline: true },
                    { name: '🔧 Sifat',    value: traits.join('\n'),                                     inline: false },
                    { name: '⚡ Efek',     value: effectText,                                             inline: false }
                )
                .setFooter({ text: `Item ID: ${def.id}` })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /inventory search ─────────────────────────────────────────────────
        if (sub === 'search') {
            const query   = interaction.options.getString('query');
            const results = await inventoryEngine.search(guildId, interaction.user.id, query);

            const embed = new EmbedBuilder()
                .setTitle(`🔍 Hasil Pencarian: "${query}"`)
                .setColor(COLORS.INFO)
                .setTimestamp();

            if (results.length === 0) {
                embed.setDescription(`*Tidak ada item yang cocok dengan kata kunci \`${query}\`.*`);
            } else {
                embed.setDescription(`Ditemukan **${results.length}** item:`);
                const page = results.slice(0, 10);
                for (const { slot, item } of page) {
                    const icon = item?.metadata?.icon ?? '📦';
                    embed.addFields({
                        name: `${icon} ${item?.name ?? slot.itemId}`,
                        value: `> \`${slot.itemId}\` | ${item?.rarity ?? '?'} ${item?.category ?? ''} | Qty: **${slot.quantity}**`,
                        inline: false
                    });
                }
                if (results.length > 10) {
                    embed.addFields({ name: '...', value: `*Dan ${results.length - 10} item lainnya.*`, inline: false });
                }
            }

            return interaction.editReply({ embeds: [embed] });
        }

        // ── /inventory stats ──────────────────────────────────────────────────
        if (sub === 'stats') {
            const [mostUsed, largest, rarest, distribution] = await Promise.all([
                inventoryStatistics.getMostUsedItems(guildId, 3),
                inventoryStatistics.getLargestInventory(guildId),
                inventoryStatistics.getRarestItem(guildId),
                inventoryStatistics.getLootDistribution(guildId, 5)
            ]);

            const embed = new EmbedBuilder()
                .setTitle('📊 Statistik Inventory Server')
                .setColor(COLORS.SUCCESS)
                .setTimestamp();

            // Most used items
            const usedText = mostUsed.length > 0
                ? mostUsed.map((r, i) => `**#${i + 1}** ${r.item?.metadata?.icon ?? '📦'} ${r.item?.name ?? r.itemId} — \`${r.useCount}\` kali`).join('\n')
                : '*Belum ada data.*';
            embed.addFields({ name: '🔥 Item Paling Sering Digunakan', value: usedText, inline: false });

            // Largest inventory
            const largestText = largest
                ? `<@${largest._id}> — \`${largest.slotCount}\` slot, \`${largest.totalItems}\` total item`
                : '*Belum ada data.*';
            embed.addFields({ name: '🐳 Inventory Terbesar', value: largestText, inline: false });

            // Rarest item in circulation
            const rarestText = rarest
                ? `${rarest.metadata?.icon ?? '📦'} **${rarest.name}** (${RARITY_EMOJI[rarest.rarity] ?? ''} ${rarest.rarity})`
                : '*Belum ada data.*';
            embed.addFields({ name: '💎 Item Paling Langka (Beredar)', value: rarestText, inline: false });

            // Distribution
            const distText = distribution.length > 0
                ? distribution.map((r, i) => `**#${i + 1}** ${r.item?.metadata?.icon ?? '📦'} ${r.item?.name ?? r.itemId} — \`${r.totalOwned}\` (${r.holders} pemilik)`).join('\n')
                : '*Belum ada data.*';
            embed.addFields({ name: '📦 Distribusi Item Terbanyak', value: distText, inline: false });

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
