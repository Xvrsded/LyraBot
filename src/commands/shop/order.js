const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Order = require('../../models/Order');
const Product = require('../../models/Product');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('order')
        .setDescription('Sistem Pesanan.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Buat pesanan baru')
                .addStringOption(option => option.setName('product').setDescription('Nama Produk').setRequired(true))
                .addNumberOption(option => option.setName('quantity').setDescription('Jumlah').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('complete')
                .setDescription('Selesaikan pesanan (Admin Only)')
                .addStringOption(option => option.setName('orderid').setDescription('Order ID').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Batalkan pesanan (Admin Only)')
                .addStringOption(option => option.setName('orderid').setDescription('Order ID').setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        try {
            if (subcommand === 'create') {
                const productName = interaction.options.getString('product');
                const quantity = interaction.options.getNumber('quantity') || 1;

                const product = await Product.findOne({ name: productName });
                if (!product || !product.active) {
                    return interaction.editReply('❌ Produk tidak ditemukan atau tidak aktif.');
                }
                if (product.stock < quantity && product.stock !== -1) { // -1 could mean unlimited
                    return interaction.editReply('❌ Stok produk tidak mencukupi.');
                }

                const orderId = `ORD-${Date.now().toString().slice(-6)}`;
                await Order.create({
                    orderId,
                    userId: interaction.user.id,
                    productId: product.name,
                    quantity
                });

                // Optionally decrease stock here if tracked rigidly
                // product.stock -= quantity; await product.save();

                await interaction.editReply(`✅ Pesanan berhasil dibuat! Order ID: **${orderId}**\nStaf akan segera memproses pesanan Anda.`);
            } else if (subcommand === 'complete' || subcommand === 'cancel') {
                // Admin check
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.editReply('❌ Anda tidak memiliki izin untuk menggunakan command ini.');
                }

                const orderId = interaction.options.getString('orderid');
                const newStatus = subcommand === 'complete' ? 'completed' : 'cancelled';
                
                const order = await Order.findOneAndUpdate(
                    { orderId },
                    { status: newStatus },
                    { new: true }
                );

                if (!order) {
                    return interaction.editReply('❌ Order ID tidak ditemukan.');
                }

                if (newStatus === 'completed') {
                    try {
                        const { triggerLeaderboardUpdate } = require('../../scripts/update_leaderboard');
                        triggerLeaderboardUpdate();
                    } catch (e) {
                        console.error('Failed to trigger leaderboard update:', e);
                    }
                }

                await interaction.editReply(`✅ Pesanan **${orderId}** telah diubah statusnya menjadi: **${newStatus}**.`);
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Terjadi kesalahan sistem.');
        }
    },
};
