const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Wallet = require('../../models/Wallet');
const LedgerEntry = require('../../models/LedgerEntry');
const transactionPipeline = require('../../services/transactionPipeline');
const { COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy')
        .setDescription('Economy and Financial Platform')
        // Subcommand: balance
        .addSubcommand(sub =>
            sub.setName('balance')
                .setDescription('Tampilkan saldo coins dan premium coins Anda')
                .addUserOption(opt => opt.setName('member').setDescription('Lihat saldo member lain').setRequired(false))
        )
        // Subcommand: transactions
        .addSubcommand(sub =>
            sub.setName('transactions')
                .setDescription('Tampilkan 10 riwayat transaksi keuangan terakhir Anda')
        )
        // Subcommand: transfer
        .addSubcommand(sub =>
            sub.setName('transfer')
                .setDescription('Transfer coins ke member lain (dikenakan pajak transfer 5%)')
                .addUserOption(opt => opt.setName('member').setDescription('Penerima transfer').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Jumlah transfer coins').setRequired(true).setMinValue(1))
        )
        // Subcommand: leaderboard
        .addSubcommand(sub =>
            sub.setName('leaderboard')
                .setDescription('Tampilkan 10 member terkaya di server')
        )
        // Subcommand: stats
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('Tampilkan statistik ekonomi server (suplai uang, rata-rata dompet)')
        ),

    /**
     * Executes `/economy` slash subcommands.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'balance') {
            const targetUser = interaction.options.getUser('member') || interaction.user;
            const wallet = await Wallet.findOne({ guildId, userId: targetUser.id });

            const coins = wallet ? wallet.coins : 0;
            const premiumCoins = wallet ? wallet.premiumCoins : 0;

            const embed = new EmbedBuilder()
                .setTitle(`💰 Dompet: ${targetUser.username}`)
                .setColor(COLORS.DEFAULT)
                .addFields(
                    { name: '🪙 Coins', value: `\`${coins.toLocaleString('id-ID')}\` Coins`, inline: true },
                    { name: '⭐ Premium Coins', value: `\`${premiumCoins.toLocaleString('id-ID')}\` Premium Coins`, inline: true }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'transactions') {
            const entries = await LedgerEntry.find({ guildId, userId: interaction.user.id })
                .sort({ timestamp: -1 })
                .limit(10);

            const embed = new EmbedBuilder()
                .setTitle('📜 Riwayat Transaksi Keuangan')
                .setDescription('Menampilkan 10 aktivitas mutasi saldo terakhir Anda.')
                .setColor(COLORS.INFO)
                .setTimestamp();

            if (entries.length === 0) {
                embed.setDescription('*Tidak ada riwayat transaksi keuangan.*');
            } else {
                entries.forEach((e, idx) => {
                    const sign = e.amount >= 0 ? '+' : '';
                    const currencyName = e.currency === 'coins' ? '🪙' : '⭐';
                    embed.addFields({
                        name: `#${idx + 1} - Tx [${e.action}]`,
                        value: `• Jumlah: **\`${sign}${e.amount.toLocaleString('id-ID')}\`** ${currencyName}\n• Saldo Akhir: \`${e.balanceAfter.toLocaleString('id-ID')}\`\n• Waktu: <t:${Math.round(e.timestamp.getTime() / 1000)}:R>`,
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'transfer') {
            const recipient = interaction.options.getUser('member');
            const amount = interaction.options.getInteger('amount');

            try {
                const result = await transactionPipeline.transfer(
                    guildId,
                    interaction.user.id,
                    recipient.id,
                    amount,
                    'coins',
                    'transfer-command'
                );

                return interaction.editReply(`✅ **Transfer Berhasil!**\n• Pengirim: <@${interaction.user.id}>\n• Penerima: <@${recipient.id}>\n• Jumlah: \`${amount}\` coins\n• Pajak Transfer (5%): \`${result.taxAmount}\` coins (Server Sink)\n• Bersih Diterima: \`${result.netAmount}\` coins.`);
            } catch (err) {
                return interaction.editReply(`❌ **Transfer Gagal**: ${err.message}`);
            }
        }

        if (subcommand === 'leaderboard') {
            const topWallets = await Wallet.find({ guildId }).sort({ coins: -1 }).limit(10);

            const embed = new EmbedBuilder()
                .setTitle('🏆 Papan Peringkat Kekayaan Server')
                .setColor(COLORS.SUCCESS)
                .setTimestamp();

            if (topWallets.length === 0) {
                embed.setDescription('*Belum ada data keuangan member.*');
            } else {
                const rows = topWallets.map((w, idx) => {
                    return `**#${idx + 1}** | <@${w.userId}> - \`${w.coins.toLocaleString('id-ID')}\` coins`;
                }).join('\n');
                embed.setDescription(rows);
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'stats') {
            // Calculate aggregated statistics
            const wallets = await Wallet.find({ guildId });
            const supply = wallets.reduce((acc, w) => acc + w.coins, 0);
            const premiumSupply = wallets.reduce((acc, w) => acc + w.premiumCoins, 0);
            const avg = wallets.length > 0 ? Math.round(supply / wallets.length) : 0;

            const largestWallet = wallets.length > 0 ? wallets.sort((a, b) => b.coins - a.coins)[0] : null;

            const embed = new EmbedBuilder()
                .setTitle('📊 Statistik Ekonomi Server')
                .setColor(COLORS.SUCCESS)
                .addFields(
                    { name: '🪙 Total Money Supply (Coins)', value: `\`${supply.toLocaleString('id-ID')}\` coins`, inline: true },
                    { name: '⭐ Premium Money Supply', value: `\`${premiumSupply.toLocaleString('id-ID')}\` premium coins`, inline: true },
                    { name: '👥 Jumlah Wallet Aktif', value: `\`${wallets.length}\` wallet`, inline: true },
                    { name: '📈 Rata-Rata Saldo Dompet', value: `\`${avg.toLocaleString('id-ID')}\` coins`, inline: true },
                    { name: '🐳 Dompet Terbesar', value: largestWallet ? `<@${largestWallet.userId}> (\`${largestWallet.coins.toLocaleString('id-ID')}\` coins)` : '`-`', inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
