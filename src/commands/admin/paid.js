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

        // ATOMIC UPDATE: Pastikan tiket masih pending
        const updatedOrder = await Order.findOneAndUpdate(
            { channelId: interaction.channel.id, status: 'pending' },
            { $set: { status: 'paid' } },
            { new: true }
        );

        if (!updatedOrder) {
            const existing = await Order.findOne({ channelId: interaction.channel.id });
            if (!existing) {
                return interaction.editReply('❌ Order tidak ditemukan untuk channel ini.');
            }
            return interaction.editReply(`❌ Order ini sudah tidak pending. Status saat ini: **${existing.status.toUpperCase()}**.`);
        }

        // Update Voice Status
        const voiceStatusService = require('../../services/voiceStatusService');
        voiceStatusService.updateAllVoiceStatuses(interaction.client);

        try {
            const messages = await interaction.channel.messages.fetch({ limit: 50 });
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
        await interaction.channel.send(
            `✅ <@${updatedOrder.userId}> Bukti pembayaran telah diverifikasi secara manual oleh Staff.\n\n` +
            `Terima kasih.\n\n` +
            `Nominal yang telah diverifikasi:\n` +
            `💰 **Rp ${updatedOrder.price.toLocaleString('id-ID')}**\n\n` +
            `Status pesanan Anda telah diperbarui menjadi:\n` +
            `🟢 **Paid**\n\n` +
            `Staff LyraBlox akan segera memproses pesanan Anda.`
        );

        return interaction.editReply('✅ Berhasil memverifikasi pembayaran.');
    }
};
