const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const Product = require('../models/Product');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const ProductOrder = require('../models/ProductOrder');
const WelcomeConfig = require('../models/WelcomeConfig');
const LeaveConfig = require('../models/LeaveConfig');
const ProductConfig = require('../models/ProductConfig');
const StoreConfig = require('../models/StoreConfig');

async function getAdminPanelEmbed(client, guild) {
    // 1. Gather server statistics
    const totalMembers = guild.memberCount;
    const totalRoles = guild.roles.cache.size;
    const totalChannels = guild.channels.cache.size;

    // 2. Query MongoDB metrics
    const activeProducts = await Product.countDocuments({ active: true });
    const activeTickets = await Ticket.countDocuments({ status: { $ne: 'closed' } });
    const totalRobuxOrders = await Order.countDocuments();
    const totalProductOrders = await ProductOrder.countDocuments();
    const totalOrders = totalRobuxOrders + totalProductOrders;

    // 3. Fetch configs status
    const welcomeCfg = await WelcomeConfig.findOne({ guildId: guild.id });
    const leaveCfg = await LeaveConfig.findOne({ guildId: guild.id });
    const productCfg = await ProductConfig.findOne({ guildId: guild.id });
    const storeCfg = await StoreConfig.findOne({ guildId: guild.id });

    const welcomeStatus = welcomeCfg?.enabled ? '🟢 Enabled' : '🔴 Disabled';
    const leaveStatus = leaveCfg?.enabled ? '🟢 Enabled' : '🔴 Disabled';
    const productStatus = productCfg?.channelId ? '🟢 Configured' : '🔴 Unconfigured';
    const storeStatus = storeCfg?.stockChannelId ? '🟢 Configured' : '🔴 Unconfigured';

    // 4. Construct Embed
    const embed = new EmbedBuilder()
        .setTitle('🛠️ WINTERBOT | MASTER ADMIN PANEL')
        .setDescription('Selamat datang di Panel Administrator Utama WinterBot. Di sini Anda dapat memantau statistik bot, melakukan sinkronisasi server, membersihkan server target, menggenerasi template channel, serta mengelola modul bot secara keseluruhan.')
        .setColor('#2b2d31')
        .addFields(
            { 
                name: '📊 Server Statistics', 
                value: `• Members: **${totalMembers}**\n• Channels: **${totalChannels}**\n• Roles: **${totalRoles}**`, 
                inline: true 
            },
            { 
                name: '📈 Business Metrics', 
                value: `• Active Products: **${activeProducts}**\n• Active Tickets: **${activeTickets}**\n• Total Completed Orders: **${totalOrders}**`, 
                inline: true 
            },
            { 
                name: '⚙️ Configured Modules', 
                value: `• Welcome System: ${welcomeStatus}\n• Goodbye System: ${leaveStatus}\n• Store Embed Channel: ${storeStatus}\n• Product Embed Channel: ${productStatus}`, 
                inline: false 
            }
        )
        .setFooter({ text: `Last Refresh: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` })
        .setTimestamp();

    // 5. Action Row 1: Buttons
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin_clone_server')
            .setLabel('🔄 Sync Server (Clone)')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('admin_autogen_server')
            .setLabel('⚡ Auto Gen Server')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('admin_wipe_server')
            .setLabel('🧹 Wipe Server')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('admin_resend_panels')
            .setLabel('🎫 Deploy Panels')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('admin_layout_update')
            .setLabel('✨ Update Layout')
            .setStyle(ButtonStyle.Success)
    );

    // 6. Action Row 2: Select Menu
    const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('admin_select_actions')
            .setPlaceholder('Pilih aksi cepat untuk melakukan konfigurasi...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Kelola Paket Harga Robux')
                    .setDescription('Edit harga dan paket Robux yang aktif')
                    .setValue('manage_prices')
                    .setEmoji('💎'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Konfigurasi Pesan Welcome')
                    .setDescription('Atur pesan penyambutan member baru')
                    .setValue('config_welcome')
                    .setEmoji('👋'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Konfigurasi Pesan Goodbye')
                    .setDescription('Atur pesan perpisahan member keluar')
                    .setValue('config_leave')
                    .setEmoji('🚪'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Lihat 10 Pesanan Terakhir')
                    .setDescription('Menampilkan riwayat transaksi terbaru')
                    .setValue('view_orders')
                    .setEmoji('📋')
            )
    );

    return { embeds: [embed], components: [buttons, selectMenu] };
}

async function updateAdminPanel(client) {
    const channelId = '1505260207100530728'; // Designated admin channel ID
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            console.warn(`[Admin Panel] Target channel ${channelId} tidak ditemukan.`);
            return;
        }

        // Fetch last 50 messages to locate previous admin panel message
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        let adminMessage = null;
        if (messages) {
            adminMessage = messages.find(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes('MASTER ADMIN PANEL'));
        }

        const panelPayload = await getAdminPanelEmbed(client, channel.guild);

        if (adminMessage) {
            await adminMessage.edit(panelPayload);
            console.log(`[Admin Panel] Panel berhasil diperbarui di channel ${channel.name}`);
        } else {
            const newMsg = await channel.send(panelPayload);
            console.log(`[Admin Panel] Panel baru berhasil dibuat di channel ${channel.name}`);
        }
    } catch (err) {
        console.error('[Admin Panel] Gagal memperbarui panel admin:', err);
    }
}

module.exports = {
    getAdminPanelEmbed,
    updateAdminPanel
};
