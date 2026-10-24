const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const settingsService = require('./settingsService');
const voiceStatusService = require('./voiceStatusService');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../utils/logger');

class TicketOrderService {
    /**
     * Check if interaction member is staff or admin
     */
    async isStaff(interaction) {
        try {
            const staffRoleId = await settingsService.get('staff_role_id');
            const adminRoleId = await settingsService.get('admin_role_id');
            const ownerRoleId = await settingsService.get('owner_role_id');

            const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id);
            const isOwner = interaction.guild?.ownerId === interaction.user.id;
            const isAdmin = member.permissions.has('Administrator');
            return member.roles.cache.has(staffRoleId) ||
                   member.roles.cache.has(adminRoleId) ||
                   member.roles.cache.has(ownerRoleId) ||
                   isOwner || isAdmin;
        } catch (err) {
            logger.error('[TicketOrderService] Error checking staff role:', err);
            return false;
        }
    }

    /**
     * Get active orders for a ticket channel
     */
    async getActiveOrders(channelId) {
        return await Order.find({
            channelId,
            status: { $in: ['pending', 'paid'] }
        }).sort({ createdAt: 1 });
    }

    /**
     * Cancel an order in a ticket and update status to 'cancelled'
     */
    async cancelOrder(orderId, channelId) {
        return await Order.findOneAndUpdate(
            { orderId, channelId, status: { $in: ['pending', 'paid'] } },
            { $set: { status: 'cancelled' } },
            { new: true }
        );
    }

    /**
     * Recalculate totals and update main ticket embed message and components
     */
    async updateTicketEmbedAndComponents(channel, client) {
        const remainingOrders = await this.getActiveOrders(channel.id);
        const newTotal = remainingOrders.reduce((sum, o) => sum + (o.price || 0), 0);
        const newAmount = remainingOrders.reduce((sum, o) => {
            let amt = 0;
            if (o.details && o.details.amount) amt = parseInt(o.details.amount) || 0;
            return sum + amt;
        }, 0);

        let botMsg = null;
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.components.length > 0);

            if (botMsg) {
                const oldEmbed = botMsg.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed);

                if (oldEmbed.fields && oldEmbed.fields.length > 0) {
                    // Filter out existing "Tambahan ke-..." fields
                    let updatedFields = oldEmbed.fields.filter(f => !f.name.toLowerCase().includes('tambahan ke-'));

                    if (remainingOrders.length > 0) {
                        const primaryOrder = remainingOrders[0];
                        const primaryUser = primaryOrder.details?.username || primaryOrder.details?.robloxUsername;
                        const primaryGamepass = primaryOrder.details?.gamepassName;
                        const primaryGameLink = primaryOrder.details?.gameLink;

                        for (let i = 0; i < updatedFields.length; i++) {
                            const fname = updatedFields[i].name.toLowerCase();
                            // Update robux amount
                            if (fname.includes('paket') || fname.includes('jumlah robux') || fname.includes('harga gamepass') || fname.includes('jumlah')) {
                                if (!updatedFields[i].value.includes('Custom')) {
                                    updatedFields[i].value = `\`${newAmount.toLocaleString('id-ID')} Robux\``;
                                }
                            }
                            // Update total price
                            if (fname.includes('total') || fname.includes('harga')) {
                                updatedFields[i].value = `\`Rp ${newTotal.toLocaleString('id-ID')}\``;
                            }
                            // Update primary gamepass name if changed
                            if (fname.includes('gamepass') && primaryGamepass) {
                                updatedFields[i].value = `\`\`\`text\n${primaryGamepass}\n\`\`\``;
                            }
                            // Update primary game link if changed
                            if ((fname.includes('game') || fname.includes('map')) && primaryGameLink) {
                                updatedFields[i].value = `\`${primaryGameLink}\``;
                            }
                            // Update primary username if changed
                            if (fname.includes('username') && primaryUser) {
                                updatedFields[i].value = `\`${primaryUser}\``;
                            }
                        }

                        // Re-insert remaining bulk order fields (indexes 1 and up)
                        const totalFieldIndex = updatedFields.findIndex(f => f.name.toLowerCase().includes('total'));
                        for (let idx = 1; idx < remainingOrders.length; idx++) {
                            const ord = remainingOrders[idx];
                            const pName = ord.productName || 'Robux';
                            const pkgLabel = (ord.details && ord.details.amount) 
                                ? `${ord.details.amount} Robux` 
                                : ((ord.details && ord.details.package) ? ord.details.package : '-');
                            const uName = (ord.details && (ord.details.username || ord.details.robloxUsername)) 
                                ? (ord.details && (ord.details.username || ord.details.robloxUsername)) 
                                : '-';

                            const bulkField = {
                                name: `📦 Tambahan ke-${idx + 1}: ${pName} (${ord.orderId})`,
                                value: `**Username:** \`${uName}\`\n**Paket:** \`${pkgLabel}\`\n**Harga:** \`Rp ${(ord.price || 0).toLocaleString('id-ID')}\``,
                                inline: false
                            };

                            if (totalFieldIndex !== -1) {
                                updatedFields.splice(totalFieldIndex + (idx - 1), 0, bulkField);
                            } else {
                                updatedFields.push(bulkField);
                            }
                        }
                    } else {
                        // 0 remaining orders
                        for (let i = 0; i < updatedFields.length; i++) {
                            const fname = updatedFields[i].name.toLowerCase();
                            if (fname.includes('total') || fname.includes('harga')) {
                                updatedFields[i].value = `\`Rp 0\``;
                            }
                            if (fname.includes('status')) {
                                updatedFields[i].value = `🔴 Semua Dibatalkan`;
                            }
                        }
                    }

                    newEmbed.setFields(updatedFields);
                }

                // If description contains formatted total price
                if (newEmbed.data.description) {
                    let desc = newEmbed.data.description;
                    desc = desc.replace(/•\s*\*\*Total Harga:\*\*\s*`Rp[0-9.,]+`/i, `• **Total Harga:** \`Rp${newTotal.toLocaleString('id-ID')}\``);
                    desc = desc.replace(/•\s*\*\*Jumlah Robux:\*\*\s*`[0-9.,]+ Robux`/i, `• **Jumlah Robux:** \`${newAmount.toLocaleString('id-ID')} Robux\``);
                    if (remainingOrders.length === 0) {
                        desc += '\n\n⚠️ **Semua pesanan dalam tiket ini telah dibatalkan.** Silakan gunakan tombol **Close Ticket**.';
                    }
                    newEmbed.setDescription(desc);
                }

                // Update components so delivery & username copy buttons point to new active primary order
                let updatedComponents = botMsg.components.map(actionRow => {
                    const newRow = ActionRowBuilder.from(actionRow);
                    const updatedButtons = actionRow.components.map(comp => {
                        if (remainingOrders.length > 0) {
                            const primaryOrder = remainingOrders[0];
                            const cId = comp.customId || comp.data?.custom_id;
                            if (cId && cId.startsWith('robux_deliver_')) {
                                return ButtonBuilder.from(comp).setCustomId(`robux_deliver_${primaryOrder.orderId}`);
                            }
                            if (cId && cId.startsWith('copy_user_') && primaryOrder.details && (primaryOrder.details.username || primaryOrder.details.robloxUsername)) {
                                return ButtonBuilder.from(comp).setCustomId(`copy_user_${primaryOrder.orderId}`);
                            }
                        }
                        return ButtonBuilder.from(comp);
                    });
                    newRow.setComponents(updatedButtons);
                    return newRow;
                });

                // Ensure ticket_delete_order button is present in components
                const hasDeleteBtn = updatedComponents.some(r => r.components.some(c => (c.data?.custom_id || c.customId) === 'ticket_delete_order'));
                if (!hasDeleteBtn) {
                    let added = false;
                    for (const r of updatedComponents) {
                        if (r.components.length < 5) {
                            r.addComponents(new ButtonBuilder().setCustomId('ticket_delete_order').setLabel('🗑️ Hapus Pesanan').setStyle(ButtonStyle.Secondary));
                            added = true;
                            break;
                        }
                    }
                    if (!added && updatedComponents.length < 5) {
                        updatedComponents.push(new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('ticket_delete_order').setLabel('🗑️ Hapus Pesanan').setStyle(ButtonStyle.Secondary)
                        ));
                    }
                }

                await botMsg.edit({ embeds: [newEmbed], components: updatedComponents });
            }

            if (remainingOrders.length > 0) {
                await Ticket.findOneAndUpdate({ ticketId: channel.id }, { orderId: remainingOrders[0].orderId });
            }

            voiceStatusService.updateAllVoiceStatuses(client);
        } catch (e) {
            logger.error('[TicketOrderService] Error updating ticket message/embed:', e);
        }

        return { remainingOrders, newTotal, newAmount, botMsg };
    }
}

module.exports = new TicketOrderService();
