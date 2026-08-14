const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const RobuxPackage = require('../models/RobuxPackage');
const settingsService = require('./settingsService');

let isSeeding = false;

const VILOG_PRICE_CATALOG = [
    { amount: 100, price: 16000, sortOrder: 1 },
    { amount: 200, price: 32000, sortOrder: 2 },
    { amount: 300, price: 48000, sortOrder: 3 },
    { amount: 400, price: 64000, sortOrder: 4 },
    { amount: 500, price: 80000, sortOrder: 5 },
    { amount: 600, price: 96000, sortOrder: 6 },
    { amount: 700, price: 112000, sortOrder: 7 },
    { amount: 800, price: 128000, sortOrder: 8 },
    { amount: 900, price: 144000, sortOrder: 9 },
    { amount: 1000, price: 160000, sortOrder: 10 }
];

const VISEND_PRICE_CATALOG = [
    { amount: 50, price: 8500, sortOrder: 1 },
    { amount: 100, price: 15000, sortOrder: 2 },
    { amount: 200, price: 30000, sortOrder: 3 },
    { amount: 300, price: 45000, sortOrder: 4 },
    { amount: 400, price: 60000, sortOrder: 5 },
    { amount: 500, price: 75000, sortOrder: 6 },
    { amount: 600, price: 90000, sortOrder: 7 },
    { amount: 700, price: 105000, sortOrder: 8 },
    { amount: 800, price: 120000, sortOrder: 9 },
    { amount: 900, price: 135000, sortOrder: 10 },
    { amount: 1000, price: 150000, sortOrder: 11 }
];

async function syncVilogPriceCatalog() {
    const targetAmounts = VILOG_PRICE_CATALOG.map(pkg => pkg.amount);

    await RobuxPackage.deleteMany(
        { type: { $in: ['LOGIN', 'login', 'robux_login'] } }
    );

    await Promise.all(VILOG_PRICE_CATALOG.map(pkg => RobuxPackage.findOneAndUpdate(
        { type: 'vilog', amount: pkg.amount },
        {
            type: 'vilog',
            amount: pkg.amount,
            price: pkg.price,
            sortOrder: pkg.sortOrder,
            displayOrder: pkg.sortOrder,
            isActive: true
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    )));

    await RobuxPackage.updateMany(
        { type: 'vilog', amount: { $nin: targetAmounts } },
        { isActive: false }
    );
}

async function syncVisendPriceCatalog() {
    const targetAmounts = VISEND_PRICE_CATALOG.map(pkg => pkg.amount);

    // Upsert required packages based on type + amount to ensure idempotency
    await Promise.all(VISEND_PRICE_CATALOG.map(pkg => RobuxPackage.findOneAndUpdate(
        { type: 'visend', amount: pkg.amount },
        {
            type: 'visend',
            amount: pkg.amount,
            price: pkg.price,
            sortOrder: pkg.sortOrder,
            displayOrder: pkg.sortOrder,
            isActive: true
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    )));

    // Clean up unwanted visend packages (e.g. 50, 150)
    await RobuxPackage.deleteMany({ type: 'visend', amount: { $nin: targetAmounts } });
}

async function seedRobuxPackages() {
    if (isSeeding) return;
    isSeeding = true;
    try {
        await syncVilogPriceCatalog();
        await syncVisendPriceCatalog();
        console.log('[Robux] Successfully synced Robux packages to DB.');
    } catch (err) {
        console.error('[Robux Seeder] Error seeding packages:', err);
    } finally {
        isSeeding = false;
    }
}

async function syncVilogPanel(client) {
    try {
        const configService = require('./configService');
        const channelId = await settingsService.get('vilog_channel_id', '1534575980788584468');
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            console.warn(`[Robux] Pricelist channel ${channelId} tidak ditemukan.`);
            return;
        }

        const packages = await configService.getProductPackages('vilog');
        
        let priceListText = '```text\n';
        if (packages.length === 0) {
            priceListText += 'Belum ada paket Robux yang tersedia.\n';
        } else {
            packages.forEach(pkg => {
                const amountStr = `${pkg.amount.toLocaleString('id-ID')} Robux`;
                const paddedAmount = amountStr.padEnd(12, ' ');
                priceListText += `${paddedAmount} = Rp ${pkg.price.toLocaleString('id-ID')}\n`;
            });
        }
        priceListText += '```';

        const brandingName = await settingsService.get('branding_name', 'LyraBlox');
        const embed = new EmbedBuilder()
            .setTitle(`🛒 ${brandingName.toUpperCase()} | PRICE LIST`)
            .setDescription(
                `\`\`\`\n╔═══════════════════╗\n    ${brandingName.toUpperCase()} STORE    \n     PRICE LIST     \n╚═══════════════════╝\n\`\`\`\n` +
                `Selamat datang di **${brandingName}**! Silakan lihat daftar paket harga Robux Via Login di bawah ini.`
            )
            .setColor('#6366f1')
            .addFields(
                { name: '📋 Daftar Paket & Harga (Via Login)', value: priceListText, inline: false },
                { name: '🛡️ Layanan Jaminan', value: '⚡ **Fast Process**\n🔒 **100% Safe & Trusted**', inline: false }
            )
            .setFooter({ text: `Last Update: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vilog_order_now').setLabel('🛒 Order Sekarang').setStyle(ButtonStyle.Success)
        );

        const config = await configService.getGlobalConfig();
        const msgId = config.panelMessageIds?.LOGIN;
        
        if (msgId) {
            const oldMsg = await channel.messages.fetch(msgId).catch(() => null);
            if (oldMsg) {
                await oldMsg.edit({ embeds: [embed], components: [row] });
                console.log(`[Robux] Vilog panel successfully EDITED in channel: #${channel.name}`);
                return;
            }
        }

        // If we reach here, either msgId didn't exist, or message was deleted
        // Delete any rogue messages from the bot with the button
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const oldMessages = messages.filter(m => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === 'vilog_order_now')));
            for (const m of oldMessages.values()) await m.delete().catch(() => {});
        } catch (err) {}

        const newMsg = await channel.send({ embeds: [embed], components: [row] });
        config.panelMessageIds = config.panelMessageIds || {};
        config.panelMessageIds.LOGIN = newMsg.id;
        config.markModified('panelMessageIds');
        await config.save();
        
        console.log(`[Robux] Vilog panel successfully DEPLOYED in channel: #${channel.name}`);
    } catch (err) {
        console.error('[Robux Service] Error syncing vilog panel:', err);
    }
}

async function refreshProductPanel(client, type) {
    const normalizedType = String(type || '').trim().toLowerCase();
    if (normalizedType === 'visend' || normalizedType === 'send') {
        await syncVisendPanel(client);
        return;
    }
    if (normalizedType === 'vilog' || normalizedType === 'login') {
        await syncVilogPanel(client);
        return;
    }
    if (normalizedType === 'gig') {
        await syncGigPanel(client);
    }
}

async function syncVisendPanel(client) {
    try {
        const configService = require('./configService');
        const channelId = await settingsService.get('visend_channel_id', '1534576102134255807');
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            console.warn(`[Robux] Visend Pricelist channel ${channelId} tidak ditemukan.`);
            return;
        }

        const packages = [...await configService.getProductPackages('visend', true)]
            .filter(pkg => pkg && pkg.isActive !== false)
            .sort((a, b) => Number(a.amount) - Number(b.amount));
        
        let priceListText = '```text\n';
        if (packages.length === 0) {
            priceListText += 'Belum ada paket Robux yang tersedia.\n';
        } else {
            packages.forEach(pkg => {
                const amount = Number(pkg.amount || 0);
                const price = Number(pkg.price || 0);
                priceListText += `${amount.toLocaleString('id-ID')}⏣ = ${price.toLocaleString('id-ID')}\n`;
            });
        }
        priceListText += '```';

        const brandingName = await settingsService.get('branding_name', 'LyraBlox');
        const embed = new EmbedBuilder()
            .setTitle(`🛒 ${brandingName.toUpperCase()} | PRICE LIST VIA SEND`)
            .setDescription(
                `\`\`\`\n╔═══════════════════╗\n    ${brandingName.toUpperCase()} STORE    \n     PRICE LIST     \n╚═══════════════════╝\n\`\`\`\n` +
                `Selamat datang di **${brandingName}**! Silakan lihat daftar harga Robux Via Send di bawah ini.`
            )
            .setColor('#f59e0b')
            .addFields(
                { name: '📋 Daftar Paket & Harga (Via Send)', value: priceListText, inline: false },
                { name: '🛡️ Informasi & Persyaratan', value: '⚡ **Fast Process** | 🔒 **100% Safe & Trusted**\n\n📌 Pastikan akun Roblox kamu sudah berusia 18+, agar tidak terkendala verifikasi orang tua saat menerima Robux.\n📌 WAJIB aktifkan V2L agar dapet menerima lebih dari 500 robux\n‼️ Mohon pastikan limit akun masih tersedia sebelum order, supaya proses kirim Robux bisa langsung berjalan lancar tanpa kendala.', inline: false }
            )
            .setFooter({ text: `Last Update: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('visend_order_now').setLabel('🛒 Order Via Send').setStyle(ButtonStyle.Success)
        );

        const config = await configService.getGlobalConfig();
        const msgId = config.panelMessageIds?.SEND;
        
        if (msgId) {
            const oldMsg = await channel.messages.fetch(msgId).catch(() => null);
            if (oldMsg) {
                await oldMsg.edit({ embeds: [embed], components: [row] });
                console.log(`[Robux] Visend panel successfully EDITED in channel: #${channel.name}`);
                return;
            }
        }

        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const oldMessages = messages.filter(m => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === 'visend_order_now')));
            for (const m of oldMessages.values()) await m.delete().catch(() => {});
        } catch (err) {}

        const newMsg = await channel.send({ embeds: [embed], components: [row] });
        config.panelMessageIds = config.panelMessageIds || {};
        config.panelMessageIds.SEND = newMsg.id;
        config.markModified('panelMessageIds');
        await config.save();
        
        console.log(`[Robux] Visend panel successfully DEPLOYED in channel: #${channel.name}`);
    } catch (err) {
        console.error('[Robux Service] Error syncing visend panel:', err);
    }
}

async function syncGigPanel(client) {
    try {
        const channelId = await settingsService.get('gig_channel_id', '1534575839931273346');
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            console.warn(`[Robux] GIG Pricelist channel ${channelId} tidak ditemukan.`);
            return;
        }

        const configService = require('./configService');
        const config = await configService.getGlobalConfig();
        const rate = config.gigRate || 90;
        const brandingName = await settingsService.get('branding_name', 'LyraBlox');
        
        // Contoh perhitungan (misal: 55 Robux)
        let samplePrice = 55 * rate;
        let roundedSample = Math.ceil(samplePrice / 500) * 500;
        
        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${brandingName.toUpperCase()} | GIFT IN GAME`)
            .setDescription(
                `Selamat datang di ${brandingName} Gift In Game.\nKami membantu proses pembelian Gamepass Roblox pada berbagai game favorit Anda.\nSilakan isi detail Gamepass yang ingin dibeli.\nHarga akan dihitung otomatis berdasarkan jumlah Robux Gamepass.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📝 **Persyaratan**\n` +
                `• Pastikan link game Roblox yang diberikan sudah benar.\n` +
                `• Pastikan nama Gamepass yang ingin dibeli sesuai.\n` +
                `• Pastikan Gamepass dapat dibeli oleh pengguna lain.\n` +
                `• Harga akan mengikuti jumlah Robux pada Gamepass.\n` +
                `• Pastikan informasi yang diberikan sudah benar sebelum melakukan pembayaran.\n` +
                `• Kesalahan informasi dari customer bukan menjadi tanggung jawab ${brandingName}.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `💰 **Sistem Harga**\n` +
                `Perhitungan menggunakan rate:\n\`\`\`text\n1 Robux = Rp${rate}\n\`\`\`\n` +
                `*Catatan: Total pembayaran akan dibulatkan ke atas untuk kelipatan Rp500 terdekat.*\n\n` +
                `Contoh Pembelian 55 Robux (Rate ${rate}):\n\`\`\`text\n55 Robux × Rp${rate} = Rp${samplePrice.toLocaleString('id-ID')}\n=> Dibulatkan menjadi Rp${roundedSample.toLocaleString('id-ID')}\n\`\`\``
            )
            .setColor('#f43f5e')
            .setFooter({ text: `LyraBlox • Last Update: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gig_order_now').setLabel('🛒 Order Sekarang').setStyle(ButtonStyle.Success)
        );

        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const oldMessages = messages.filter(m => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === 'gig_order_now')));
            for (const m of oldMessages.values()) await m.delete().catch(() => {});
        } catch (err) {}

        await channel.send({ embeds: [embed], components: [row] });
        console.log(`[Robux] GIG panel list successfully updated in channel: #${channel.name}`);
    } catch (err) {
        console.error('[Robux Service] Error syncing GIG panel:', err);
    }
}

module.exports = {
    seedRobuxPackages,    refreshProductPanel,    syncVilogPanel,
    syncVisendPanel,
    syncGigPanel
};
