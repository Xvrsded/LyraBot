const StoreSetting = require('../models/StoreSetting');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function getStoreSetting() {
    let setting = await StoreSetting.findOne();
    if (!setting) {
        setting = await StoreSetting.create({});
    }
    return setting;
}

async function getDashboardStats() {
    // Ticket Aktif
    const activeTickets = await Ticket.countDocuments({ status: { $ne: 'closed' } });
    
    // Order Hari Ini
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const ordersToday = await Order.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    return { activeTickets, ordersToday };
}

async function buildDashboardMessage(client) {
    const setting = await getStoreSetting();
    const stats = await getDashboardStats();

    // Ensure products subdocument is initialized
    if (!setting.products || !setting.products.robux_login || !setting.products.robux_send || !setting.products.gift_in_game) {
        setting.products = {
            robux_login: { enabled: setting.products?.robux_login?.enabled ?? true },
            robux_send: { enabled: setting.products?.robux_send?.enabled ?? true },
            gift_in_game: { enabled: setting.products?.gift_in_game?.enabled ?? true },
            copay: { enabled: setting.products?.copay?.enabled ?? true },
            mm_rekber: { status: setting.products?.mm_rekber?.status ?? 'OPEN' }
        };
        await setting.save();
    }

    const loginIcon = setting.products.robux_login.enabled ? '🟢' : '🔴';
    const sendIcon = setting.products.robux_send.enabled ? '🟢' : '🔴';
    const gigIcon = setting.products.gift_in_game.enabled ? '🟢' : '🔴';
    const copayIcon = (setting.products.copay && setting.products.copay.enabled) ? '🟢' : '🔴';
    const mmIcon = (setting.products.mm_rekber?.status === 'OPEN') ? '🟢' : '🔴';

    const limitedIcon = (!setting.products.limited_item || setting.products.limited_item.status === 'OPEN') ? '🟢' : '🔴';

    const embed = new EmbedBuilder()
        .setTitle('🛠️ LYRABLOX CONTROL CENTER')
        .setDescription(
            `📦 **Product Status**\n` +
            `${loginIcon} Robux Via Login\n` +
            `${sendIcon} Robux Via Send\n` +
            `${gigIcon} Gift In Game\n` +
            `${copayIcon} Community Payout\n` +
            `${mmIcon} MM / Rekber\n` +
            `${limitedIcon} Limited Item\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📊 **Informasi**\n` +
            `• **Kategori Aktif:** 5 / 5\n` +
            `• **GIG Rate:** Rp${setting.gigRate || 0} / Robux\n` +
            `• **Ticket Aktif:** ${stats.activeTickets}\n` +
            `• **Order Hari Ini:** ${stats.ordersToday}`
        )
        .setColor('#0099ff')
        .setFooter({ text: `Last Update: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}` })
        .setTimestamp();

    // Row 1: Product Status Toggles
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('toggle_robux_login')
            .setLabel(`${setting.products.robux_login.enabled ? '🟢' : '🔴'} Via Login`)
            .setStyle(setting.products.robux_login.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('toggle_robux_send')
            .setLabel(`${setting.products.robux_send.enabled ? '🟢' : '🔴'} Via Send`)
            .setStyle(setting.products.robux_send.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('toggle_gift_in_game')
            .setLabel(`${setting.products.gift_in_game.enabled ? '🟢' : '🔴'} GIG`)
            .setStyle(setting.products.gift_in_game.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('toggle_copay')
            .setLabel(`${(setting.products.copay && setting.products.copay.enabled) ? '🟢' : '🔴'} Payout`)
            .setStyle((setting.products.copay && setting.products.copay.enabled) ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    // Row 2: Management Menus
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('dashboard_menu_inventory')
            .setLabel('📦 Inventory Management')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('dashboard_menu_product')
            .setLabel('📦 Product Management')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('dashboard_menu_gig')
            .setLabel('⚙️ GIG Config')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('dashboard_menu_mm')
            .setLabel('🛡️ MM Management')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('dashboard_limited_menu')
            .setLabel('💎 Limited Mgt')
            .setStyle(ButtonStyle.Primary)
    );

    // Row 3: Admin Actions
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('dashboard_refresh_server')
            .setLabel('🔄 Refresh Server')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2, row3] };
}

module.exports = {
    getStoreSetting,
    getDashboardStats,
    buildDashboardMessage
};
