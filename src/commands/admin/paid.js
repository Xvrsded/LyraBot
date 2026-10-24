const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Order = require('../../models/Order');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('paid')
        .setDescription('Verifikasi manual bahwa pembayaran telah diterima (Staff Only).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Hanya bekerja di dalam channel ticket
        if (!interaction.channel.name.startsWith('vilog-') && 
            !interaction.channel.name.startsWith('visend-') && 
            !interaction.channel.name.startsWith('gig-') && 
            !interaction.channel.name.startsWith('buy-')) {
            return interaction.editReply('❌ Command ini hanya dapat digunakan di dalam channel Ticket.');
        }

        // ATOMIC UPDATE: Pastikan semua pesanan yang pending di tiket ini diubah menjadi paid
        const pendingOrders = await Order.find({ channelId: interaction.channel.id, status: 'pending' });

        if (!pendingOrders || pendingOrders.length === 0) {
            const existing = await Order.find({ channelId: interaction.channel.id });
            if (!existing || existing.length === 0) {
                return interaction.editReply('❌ Order tidak ditemukan untuk channel ini.');
            }
            const currentStatuses = existing.map(e => e.status).join(', ');
            return interaction.editReply(`❌ Tidak ada pesanan yang berstatus pending di channel ini. Status saat ini: **${currentStatuses.toUpperCase()}**.`);
        }

        await Order.updateMany(
            { channelId: interaction.channel.id, status: 'pending' },
            { $set: { status: 'paid' } }
        );

        const totalVerifiedPrice = pendingOrders.reduce((sum, o) => sum + (o.price || 0), 0);
        const primaryUserId = pendingOrders[0].userId;

        // Update Voice Status
        const voiceStatusService = require('../../services/voiceStatusService');
        voiceStatusService.updateAllVoiceStatuses(interaction.client);

        try {
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            const botMsg = messages.find(m => m.author.id === interaction.client.user.id && m.embeds.length > 0 && m.components.length > 0);
            
            if (botMsg) {
                const oldEmbed = botMsg.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed)
                    .setColor('#00ff00');
                
                if (oldEmbed.description) {
                    const desc = oldEmbed.description;
                    const updatedDesc = desc.replace(/Status:\s*🟡\s*\*Menunggu Pembayaran\*/i, 'Status: **🟢 Paid**')
                                           .replace(/Status:\s*🟡\s*Menunggu Pembayaran/i, 'Status: **🟢 Paid**')
                                           .replace(/🟡 Pending/i, '🟢 Paid');
                    newEmbed.setDescription(updatedDesc);
                }

                if (oldEmbed.fields && oldEmbed.fields.length > 0) {
                    const updatedFields = oldEmbed.fields.map(f => {
                        if (f.name.toLowerCase().includes('status')) {
                            return { name: f.name, value: '🟢 Paid', inline: f.inline };
                        }
                        return f;
                    });
                    newEmbed.setFields(updatedFields);
                }

                await botMsg.edit({ embeds: [newEmbed] });
            }
        } catch (err) {
            console.error('[Paid Command] Failed to edit ticket embed status:', err.message);
        }

        // Send success feedback to the channel so the customer sees it
        const orderInfo = pendingOrders.length > 1 ? ` (${pendingOrders.length} pesanan)` : '';
        await interaction.channel.send(
            `✅ <@${primaryUserId}> Bukti pembayaran telah diverifikasi secara manual oleh Staff.\n\n` +
            `Terima kasih.\n\n` +
            `Nominal yang telah diverifikasi:\n` +
            `💰 **Rp ${totalVerifiedPrice.toLocaleString('id-ID')}**${orderInfo}\n\n` +
            `Status pesanan Anda telah diperbarui menjadi:\n` +
            `🟢 **Paid**\n\n` +
            `Staff LyraBlox akan segera memproses pesanan Anda.`
        );

        return interaction.editReply(`✅ Berhasil memverifikasi pembayaran untuk ${pendingOrders.length} pesanan.`);
    }
};
