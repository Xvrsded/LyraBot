const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const ticketOrderService = require('../../services/ticketOrderService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hapusorder')
        .setDescription('Hapus atau batalkan salah satu pesanan bulk di dalam tiket tanpa menutup tiket (Staff Only).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const isStaff = await ticketOrderService.isStaff(interaction);
        if (!isStaff) {
            return interaction.editReply('❌ Anda tidak memiliki izin untuk menggunakan perintah ini.');
        }

        const activeOrders = await ticketOrderService.getActiveOrders(interaction.channel.id);
        if (!activeOrders || activeOrders.length === 0) {
            return interaction.editReply('ℹ️ Tidak ditemukan pesanan aktif (pending/paid) pada channel tiket ini.');
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select_delete_order')
            .setPlaceholder('Pilih pesanan yang ingin dibatalkan / dihapus...');

        const options = activeOrders.map((ord, idx) => {
            let robuxOrPkg = '';
            if (ord.details) {
                if (ord.details.amount) robuxOrPkg = `${ord.details.amount} Robux`;
                else if (ord.details.package) robuxOrPkg = ord.details.package;
                else if (ord.details.packageLabel) robuxOrPkg = ord.details.packageLabel;
            }
            let userStr = (ord.details && (ord.details.username || ord.details.robloxUsername)) ? `User: ${ord.details.username || ord.details.robloxUsername}` : '';

            let desc = `Rp ${(ord.price || 0).toLocaleString('id-ID')}`;
            if (robuxOrPkg) desc += ` • ${robuxOrPkg}`;
            if (userStr) desc += ` • ${userStr}`;

            return {
                label: `#${idx + 1} - ${ord.orderId} (${ord.productName || 'Order'})`.substring(0, 100),
                description: desc.substring(0, 100),
                value: ord.orderId
            };
        });

        selectMenu.addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const deleteEmbed = new EmbedBuilder()
            .setTitle('🗑️ Hapus Pesanan dari Tiket (Staff Only)')
            .setDescription(
                `Ditemukan **${activeOrders.length} pesanan aktif** di tiket ini.\n\n` +
                `Silakan pilih pesanan yang ingin dibatalkan pada menu dropdown di bawah.\n\n` +
                `⚠️ **Penting:**\n` +
                `• Menghapus pesanan **TIDAK AKAN** menutup tiket ini.\n` +
                `• Pesanan yang dihapus akan berstatus \`cancelled\` dan tidak masuk ke rekap log transaksi.\n` +
                `• Total pembayaran tiket akan dihitung ulang secara otomatis.`
            )
            .setColor('#ef4444');

        return await interaction.editReply({ embeds: [deleteEmbed], components: [row] });
    }
};
