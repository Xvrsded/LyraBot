const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const WelcomeConfig = require('../models/WelcomeConfig');
const LeaveConfig = require('../models/LeaveConfig');
const ProductConfig = require('../models/ProductConfig');
const StoreConfig = require('../models/StoreConfig');
const { updateStoreEmbed } = require('./storeService');
const { updateProductEmbed } = require('./productService');

function translateOverwrites(overwritesCache, targetGuild, roleMap) {
    const overwrites = [];
    for (const ow of overwritesCache.values()) {
        let newId;
        if (ow.id === ow.channel.guild.id) {
            newId = targetGuild.id; // Map @everyone to target guild everyone ID
        } else {
            newId = roleMap[ow.id]; // Map role ID
        }

        if (newId) {
            overwrites.push({
                id: newId,
                type: ow.type, // 0 for role, 1 for member
                allow: ow.allow.bitfield,
                deny: ow.deny.bitfield
            });
        } else if (ow.type === 1) {
            // User/member overwrites are identical across guilds
            overwrites.push({
                id: ow.id,
                type: ow.type,
                allow: ow.allow.bitfield,
                deny: ow.deny.bitfield
            });
        }
    }
    return overwrites;
}

async function cloneGuild(client, sourceGuild, targetGuildId) {
    // 1. Fetch Target Guild
    const targetGuild = await client.guilds.fetch(targetGuildId).catch(() => null);
    if (!targetGuild) {
        throw new Error('Bot tidak berada di server tujuan! Pastikan bot sudah di-invite ke server target.');
    }

    if (sourceGuild.id === targetGuildId) {
        throw new Error('Server asal dan server tujuan tidak boleh sama.');
    }

    console.log(`[Clone] Starting sync from ${sourceGuild.name} to ${targetGuild.name}...`);

    // 2. Update Target Guild @everyone Permissions
    try {
        await targetGuild.roles.everyone.setPermissions(sourceGuild.roles.everyone.permissions.bitfield);
        console.log('[Clone] Updated @everyone permissions.');
    } catch (err) {
        console.error('[Clone] Failed to update @everyone permissions:', err.message);
    }

    // 3. Clone Roles
    const roleMap = {}; // mapping oldRoleId -> newRoleId
    const sourceRoles = [...sourceGuild.roles.cache.values()]
        .filter(role => role.id !== sourceGuild.id && !role.managed)
        .sort((a, b) => a.position - b.position);

    let rolesCreatedCount = 0;
    for (const role of sourceRoles) {
        try {
            const existingRole = targetGuild.roles.cache.find(r => r.name === role.name && !r.managed);
            if (existingRole) {
                roleMap[role.id] = existingRole.id;
                console.log(`[Clone] Reused existing role: ${role.name}`);
                continue;
            }

            const newRole = await targetGuild.roles.create({
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                mentionable: role.mentionable,
                permissions: role.permissions.bitfield,
                reason: `Sync / Clone from ${sourceGuild.name}`
            });
            roleMap[role.id] = newRole.id;
            rolesCreatedCount++;
            console.log(`[Clone] Created role: ${role.name}`);
        } catch (err) {
            console.error(`[Clone] Failed to create role ${role.name}:`, err.message);
        }
    }

    // 4. Clone Categories and Channels
    const channelMap = {}; // mapping oldChannelId -> newChannelId

    // 4a. Create Categories
    const categories = [...sourceGuild.channels.cache.values()]
        .filter(c => c.type === 4) // GuildCategory
        .sort((a, b) => a.position - b.position);

    let categoriesCreatedCount = 0;
    for (const cat of categories) {
        try {
            const overwrites = translateOverwrites(cat.permissionOverwrites.cache, targetGuild, roleMap);
            const newCat = await targetGuild.channels.create({
                name: cat.name,
                type: cat.type,
                permissionOverwrites: overwrites,
                reason: `Sync / Clone from ${sourceGuild.name}`
            });
            channelMap[cat.id] = newCat.id;
            categoriesCreatedCount++;
            console.log(`[Clone] Created category: ${cat.name}`);
        } catch (err) {
            console.error(`[Clone] Failed to create category ${cat.name}:`, err.message);
        }
    }

    // 4b. Create Channels (Text, Voice, etc.)
    const channels = [...sourceGuild.channels.cache.values()]
        .filter(c => c.type !== 4) // Not Category
        .sort((a, b) => a.position - b.position);

    let channelsCreatedCount = 0;
    for (const chan of channels) {
        try {
            const newParentId = chan.parentId ? channelMap[chan.parentId] : null;
            const overwrites = translateOverwrites(chan.permissionOverwrites.cache, targetGuild, roleMap);

            const newChan = await targetGuild.channels.create({
                name: chan.name,
                type: chan.type,
                topic: chan.topic,
                nsfw: chan.nsfw,
                bitrate: chan.bitrate,
                userLimit: chan.userLimit,
                rateLimitPerUser: chan.rateLimitPerUser,
                parent: newParentId,
                permissionOverwrites: overwrites,
                reason: `Sync / Clone from ${sourceGuild.name}`
            });
            channelMap[chan.id] = newChan.id;
            channelsCreatedCount++;
            console.log(`[Clone] Created channel: ${chan.name}`);
        } catch (err) {
            console.error(`[Clone] Failed to create channel ${chan.name}:`, err.message);
        }
    }

    // 5. Synchronize MongoDB Configs
    console.log('[Clone] Syncing database configurations...');

    // 5a. WelcomeConfig
    const sourceWelcome = await WelcomeConfig.findOne({ guildId: sourceGuild.id });
    if (sourceWelcome) {
        const newWelcomeChannelId = channelMap[sourceWelcome.channelId] || null;
        const newWelcomeAutoRole = roleMap[sourceWelcome.autoRole] || null;
        await WelcomeConfig.findOneAndUpdate(
            { guildId: targetGuild.id },
            {
                channelId: newWelcomeChannelId,
                message: sourceWelcome.message,
                welcomeGif: sourceWelcome.welcomeGif,
                autoRole: newWelcomeAutoRole,
                enabled: sourceWelcome.enabled
            },
            { upsert: true }
        );
        console.log('[Clone] Sync WelcomeConfig.');
    }

    // 5b. LeaveConfig
    const sourceLeave = await LeaveConfig.findOne({ guildId: sourceGuild.id });
    if (sourceLeave) {
        const newLeaveChannelId = channelMap[sourceLeave.channelId] || null;
        await LeaveConfig.findOneAndUpdate(
            { guildId: targetGuild.id },
            {
                channelId: newLeaveChannelId,
                message: sourceLeave.message,
                leaveGif: sourceLeave.leaveGif,
                enabled: sourceLeave.enabled
            },
            { upsert: true }
        );
        console.log('[Clone] Sync LeaveConfig.');
    }

    // 5c. ProductConfig
    const sourceProduct = await ProductConfig.findOne({ guildId: sourceGuild.id });
    if (sourceProduct) {
        const newProductChannelId = channelMap[sourceProduct.channelId] || null;
        await ProductConfig.findOneAndUpdate(
            { guildId: targetGuild.id },
            {
                channelId: newProductChannelId,
                messageId: null
            },
            { upsert: true }
        );
        console.log('[Clone] Sync ProductConfig.');
    }

    // 5d. StoreConfig
    const sourceStore = await StoreConfig.findOne({ guildId: sourceGuild.id });
    if (sourceStore) {
        const newStockChannelId = channelMap[sourceStore.stockChannelId] || null;
        await StoreConfig.findOneAndUpdate(
            { guildId: targetGuild.id },
            {
                stockChannelId: newStockChannelId,
                messageId: null,
                packages: sourceStore.packages,
                lastPersonalAvailable: sourceStore.lastPersonalAvailable,
                lastGroupAvailable: sourceStore.lastGroupAvailable,
                lastPending: sourceStore.lastPending
            },
            { upsert: true }
        );
        console.log('[Clone] Sync StoreConfig.');
    }

    // 6. Deploy Active Embeds & Panels to Target Guild
    console.log('[Clone] Deploying embedded panels in target guild...');

    try {
        await updateStoreEmbed(client);
        console.log('[Clone] Deployed Store Stock embed.');
    } catch (err) {
        console.error('[Clone] Failed to deploy Store Stock embed:', err.message);
    }

    try {
        await updateProductEmbed(client, targetGuild.id);
        console.log('[Clone] Deployed Product List embed.');
    } catch (err) {
        console.error('[Clone] Failed to deploy Product List embed:', err.message);
    }

    try {
        const verifyChannel = targetGuild.channels.cache.find(c => c.type === 0 && (c.name.includes('verify') || c.name.includes('verif') || c.name.includes('konfirmasi')));
        if (verifyChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🔐 Verifikasi Akun Roblox')
                .setDescription('Silakan klik tombol di bawah ini untuk memverifikasi akun Roblox Anda dan mengecek kelayakan Payout.\n\n**Syarat Payout:**\n1. Harus tergabung di Community Roblox kami.\n2. Harus sudah berada di Community Roblox kami selama minimal 14 Hari (Server Discord ini hanya untuk antrean / order Robux).')
                .setColor('#0099ff');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_btn')
                    .setLabel('Verifikasi Sekarang')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔗')
            );
            await verifyChannel.send({ embeds: [embed], components: [row] });
            console.log(`[Clone] Deployed Verification Panel to #${verifyChannel.name}`);
        }
    } catch (err) {
        console.error('[Clone] Failed to deploy Verification Panel:', err.message);
    }

    try {
        const ticketChannel = targetGuild.channels.cache.find(c => c.type === 0 && (c.name.includes('ticket') || c.name.includes('support') || c.name.includes('bantuan')));
        if (ticketChannel) {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('WinterBot Support')
                .setDescription('Silakan klik tombol di bawah ini untuk membuat tiket baru sesuai kebutuhan Anda.');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_support').setLabel('Support').setEmoji('🎫').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket_order').setLabel('Order').setEmoji('🛒').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ticket_ugc').setLabel('Custom UGC').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('ticket_report').setLabel('Report').setEmoji('🐛').setStyle(ButtonStyle.Danger)
            );
            await ticketChannel.send({ embeds: [embed], components: [row] });
            console.log(`[Clone] Deployed Ticket Panel to #${ticketChannel.name}`);
        }
    } catch (err) {
        console.error('[Clone] Failed to deploy Ticket Panel:', err.message);
    }

    console.log(`[Clone] Synchronized successfully to server: ${targetGuild.name}`);

    return {
        targetGuildName: targetGuild.name,
        rolesCreatedCount,
        categoriesCreatedCount,
        channelsCreatedCount
    };
}

async function wipeGuild(client, targetGuildId) {
    const targetGuild = await client.guilds.fetch(targetGuildId).catch(() => null);
    if (!targetGuild) {
        throw new Error('Bot tidak berada di server tujuan! Pastikan bot sudah di-invite ke server target.');
    }

    console.log(`[Wipe] Starting wipe for ${targetGuild.name}...`);

    // 1. Delete all channels and categories
    const channels = await targetGuild.channels.fetch();
    for (const channel of channels.values()) {
        await channel.delete(`Wipe Server by WinterBot Admin`).catch(err => {
            console.error(`[Wipe] Failed to delete channel ${channel.name}:`, err.message);
        });
    }

    // 2. Delete all roles except @everyone and bot integration roles
    const roles = await targetGuild.roles.fetch();
    let rolesDeletedCount = 0;
    for (const role of roles.values()) {
        if (role.id !== targetGuild.id && !role.managed) {
            await role.delete(`Wipe Server by WinterBot Admin`).then(() => {
                rolesDeletedCount++;
            }).catch(err => {
                console.error(`[Wipe] Failed to delete role ${role.name}:`, err.message);
            });
        }
    }

    console.log(`[Wipe] Successfully wiped server: ${targetGuild.name}`);
    return {
        targetGuildName: targetGuild.name,
        rolesDeletedCount
    };
}

async function generateTemplate(client, targetGuildId, templateType) {
    const targetGuild = await client.guilds.fetch(targetGuildId).catch(() => null);
    if (!targetGuild) {
        throw new Error('Bot tidak berada di server tujuan! Pastikan bot sudah di-invite ke server target.');
    }

    console.log(`[AutoGen] Generating template "${templateType}" in ${targetGuild.name}...`);

    const roleMap = {};
    const channelMap = {};
    let rolesCreated = 0;
    let categoriesCreated = 0;
    let channelsCreated = 0;

    if (templateType === 'roblox_store') {
        // Generates identical channels and roles from source config
        const rolesToCreate = [
            { name: '👤Warga', color: '#979c9f', hoist: false, permissions: [] },
            { name: '✅Verify 14 Hari', color: '#2ecc71', hoist: true, permissions: [] },
            { name: '🧑‍💼Mentri', color: '#3498db', hoist: true, permissions: [] },
            { name: '💸Spender', color: '#f1c40f', hoist: true, permissions: [] },
            { name: '👑Admin👑', color: '#e74c3c', hoist: true, permissions: [] },
            { name: '👑Presiden', color: '#ad1457', hoist: true, permissions: ['Administrator'] }
        ];

        for (const r of rolesToCreate) {
            try {
                const newRole = await targetGuild.roles.create({
                    name: r.name,
                    color: r.color,
                    hoist: r.hoist,
                    permissions: r.permissions,
                    reason: `Auto-gen template roblox_store`
                });
                roleMap[r.name] = newRole.id;
                rolesCreated++;
            } catch (err) {
                console.error(`[AutoGen] Failed to create role ${r.name}:`, err.message);
            }
        }

        const structure = [
            {
                category: '[🏆] ✦ important',
                channels: [
                    { name: '👋✦【welcome】', type: 0 },
                    { name: '😟✦【goodbye】', type: 0 },
                    { name: '📢✦【announcement】', type: 0 },
                    { name: '✅✦【verify-username】', type: 0 }
                ]
            },
            {
                category: '[🗣️] ✦ chill place',
                channels: [
                    { name: '💬【discussion】', type: 0 },
                    { name: '🌍【tiktok-share】', type: 0 },
                    { name: '🗣️【ngobrol】', type: 0 }
                ]
            },
            {
                category: '[🎫] ✦ orders',
                channels: [
                    { name: '🎟️【robux-username】', type: 0 },
                    { name: '💸【bukti-transfer】', type: 0 },
                    { name: '🔔✦【stock-alert】', type: 0 },
                    { name: '📄【list-product】', type: 0 }
                ]
            },
            {
                category: '[🎯] ✦ stats',
                channels: [
                    { name: '🎯✦【payout-status】', type: 0 },
                    { name: '🏆✦【leaderboard】', type: 0 }
                ]
            },
            {
                category: '[🤖] ✦ bot commands',
                channels: [
                    { name: '🤖【bot-command】', type: 0 }
                ]
            }
        ];

        for (const catData of structure) {
            try {
                const category = await targetGuild.channels.create({
                    name: catData.category,
                    type: 4
                });
                categoriesCreated++;

                for (const chanData of catData.channels) {
                    const channel = await targetGuild.channels.create({
                        name: chanData.name,
                        type: chanData.type,
                        parent: category.id
                    });
                    channelMap[chanData.name] = channel.id;
                    channelsCreated++;
                }
            } catch (err) {
                console.error(`[AutoGen] Failed to create structure for ${catData.category}:`, err.message);
            }
        }

        console.log('[AutoGen] Syncing database configurations for Roblox Store...');
        const verifyRoleId = roleMap['👤Warga'] || null;

        await WelcomeConfig.findOneAndUpdate(
            { guildId: targetGuild.id },
            {
                channelId: channelMap['👋✦【welcome】'] || null,
                autoRole: verifyRoleId,
                enabled: true
            },
            { upsert: true }
        );

        await LeaveConfig.findOneAndUpdate(
            { guildId: targetGuild.id },
            {
                channelId: channelMap['😟✦【goodbye】'] || null,
                enabled: true
            },
            { upsert: true }
        );

        await ProductConfig.findOneAndUpdate(
            { guildId: targetGuild.id },
            {
                channelId: channelMap['📄【list-product】'] || null,
                messageId: null
            },
            { upsert: true }
        );

        await StoreConfig.findOneAndUpdate(
            { guildId: targetGuild.id },
            {
                stockChannelId: channelMap['🎟️【robux-username】'] || null,
                messageId: null
            },
            { upsert: true }
        );

        try {
            await updateStoreEmbed(client);
        } catch (e) {
            console.error(e);
        }
        try {
            await updateProductEmbed(client, targetGuild.id);
        } catch (e) {
            console.error(e);
        }

        try {
            const vChannelId = channelMap['✅✦【verify-username】'];
            const vChannel = vChannelId ? await targetGuild.channels.fetch(vChannelId).catch(() => null) : null;
            if (vChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🔐 Verifikasi Akun Roblox')
                    .setDescription('Silakan klik tombol di bawah ini untuk memverifikasi akun Roblox Anda dan mengecek kelayakan Payout.\n\n**Syarat Payout:**\n1. Harus tergabung di Community Roblox kami.\n2. Harus sudah berada di Community Roblox kami selama minimal 14 Hari (Server Discord ini hanya untuk antrean / order Robux).')
                    .setColor('#0099ff');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('verify_btn').setLabel('Verifikasi Sekarang').setStyle(ButtonStyle.Success).setEmoji('🔗')
                );
                await vChannel.send({ embeds: [embed], components: [row] });
            }
        } catch (e) {
            console.error(e);
        }

        try {
            const tChannelId = channelMap['🎟️【robux-username】'];
            const tChannel = tChannelId ? await targetGuild.channels.fetch(tChannelId).catch(() => null) : null;
            if (tChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('WinterBot Support')
                    .setDescription('Silakan klik tombol di bawah ini untuk membuat tiket baru sesuai kebutuhan Anda.');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_support').setLabel('Support').setEmoji('🎫').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_order').setLabel('Order').setEmoji('🛒').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_ugc').setLabel('Custom UGC').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ticket_report').setLabel('Report').setEmoji('🐛').setStyle(ButtonStyle.Danger)
                );
                await tChannel.send({ embeds: [embed], components: [row] });
            }
        } catch (e) {
            console.error(e);
        }

    } else if (templateType === 'owo_bot') {
        // 1. Create Roles
        const rolesToCreate = [
            // OWNER
            { name: 'Owner', color: '#ff0000', hoist: true, permissions: [PermissionFlagsBits.Administrator] },
            { name: 'Developer', color: '#1abc9c', hoist: true, permissions: [PermissionFlagsBits.Administrator] },
            { name: 'Server Manager', color: '#e67e22', hoist: true, permissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] },

            // STAFF
            { name: 'Head Admin', color: '#e74c3c', hoist: true, permissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ModerateMembers] },
            { name: 'Admin', color: '#e74c3c', hoist: true, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ModerateMembers] },
            { name: 'Moderator', color: '#2ecc71', hoist: true, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageMessages] },
            { name: 'Trial Moderator', color: '#2ecc71', hoist: false, permissions: [PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageMessages] },
            { name: 'Support Team', color: '#3498db', hoist: true, permissions: [] },
            { name: 'Event Team', color: '#e91e63', hoist: true, permissions: [] },

            // MEMBERS
            { name: 'Booster', color: '#f47fff', hoist: true, permissions: [] },
            { name: 'VIP', color: '#f1c40f', hoist: true, permissions: [] },
            { name: 'Verified', color: '#2ecc71', hoist: false, permissions: [] },
            { name: 'Member', color: '#99aab5', hoist: false, permissions: [] },

            // OWO RANK
            { name: 'Beginner', color: '#979c9f', hoist: false, permissions: [] },
            { name: 'Hunter', color: '#71368a', hoist: false, permissions: [] },
            { name: 'Elite Hunter', color: '#ad1457', hoist: false, permissions: [] },
            { name: 'Veteran', color: '#11806a', hoist: false, permissions: [] },
            { name: 'Master Hunter', color: '#a84300', hoist: false, permissions: [] },
            { name: 'Legend', color: '#ad1457', hoist: true, permissions: [] },
            { name: 'Immortal', color: '#1f8b4c', hoist: true, permissions: [] },

            // COLORS
            { name: 'Red', color: '#e74c3c', hoist: false, permissions: [] },
            { name: 'Blue', color: '#3498db', hoist: false, permissions: [] },
            { name: 'Purple', color: '#9b59b6', hoist: false, permissions: [] },
            { name: 'Pink', color: '#e91e63', hoist: false, permissions: [] },
            { name: 'Orange', color: '#e67e22', hoist: false, permissions: [] },
            { name: 'Green', color: '#2ecc71', hoist: false, permissions: [] },
            { name: 'Black', color: '#23272a', hoist: false, permissions: [] },
            { name: 'White', color: '#ffffff', hoist: false, permissions: [] }
        ];

        for (const r of rolesToCreate) {
            try {
                const newRole = await targetGuild.roles.create({
                    name: r.name,
                    color: r.color,
                    hoist: r.hoist,
                    permissions: r.permissions,
                    reason: `Auto-gen template owo_bot`
                });
                roleMap[r.name] = newRole.id;
                rolesCreated++;
            } catch (err) {
                console.error(`[AutoGen] Failed to create role ${r.name}:`, err.message);
            }
        }

        // 2. Define Category & Channel Structure with Custom Rules
        const structure = [
            {
                category: '📜 INFORMATION',
                channels: [
                    { name: '📖・rules', type: 0, topic: 'Saluran peraturan server.', isReadonly: true },
                    { name: '📢・announcements', type: 0, topic: 'Saluran pengumuman resmi.', isReadonly: true },
                    { name: '📅・events', type: 0, topic: 'Saluran jadwal event server.' },
                    { name: '📋・server-guide', type: 0, topic: 'Panduan navigasi server.', isReadonly: true },
                    { name: '❓・faq', type: 0, topic: 'Pertanyaan yang sering diajukan (FAQ).', isReadonly: true },
                    { name: '🎭・roles', type: 0, topic: 'Saluran klaim role/warna.' },
                    { name: '📜・changelog', type: 0, topic: 'Catatan pembaruan server/bot.' },
                    { name: '📌・important-links', type: 0, topic: 'Tautan penting komunitas.', isReadonly: true }
                ]
            },
            {
                category: '💬 COMMUNITY',
                channels: [
                    { name: '💬・general', type: 0, topic: 'Saluran ngobrol santai umum.' },
                    { name: '👋・introductions', type: 0, topic: 'Perkenalkan diri kamu di sini!' },
                    { name: '📷・media', type: 0, topic: 'Bagikan foto atau video menarik.' },
                    { name: '😂・memes', type: 0, topic: 'Bagikan meme lucu.' },
                    { name: '🖼️・artwork', type: 0, topic: 'Tunjukkan karya seni buatanmu!' },
                    { name: '🎵・music', type: 0, topic: 'Rekomendasi atau obrolan seputar musik.' },
                    { name: '🎮・gaming', type: 0, topic: 'Saluran diskusi game.' },
                    { name: '🍜・food', type: 0, topic: 'Bagikan foto makanan lezatmu!' },
                    { name: '🌍・off-topic', type: 0, topic: 'Obrolan di luar topik utama.' },
                    { name: '🤖・bot-commands', type: 0, topic: 'Perintah bot umum.' }
                ]
            },
            {
                category: '⚔ OWO',
                channels: [
                    { name: '🏹・hunt', type: 0, topic: 'Perintah: `owo hunt` / `owo h`.' },
                    { name: '⚔️・battle', type: 0, topic: 'Perintah: `owo battle` / `owo b`.' },
                    { name: '🐉・pets', type: 0, topic: 'Saluran interaksi pet OwO.' },
                    { name: '💰・economy', type: 0, topic: 'Pengecekan koin: `owo cash` / `owo cowo`.' },
                    { name: '🏪・market', type: 0, topic: 'Perdagangan item market OwO.' },
                    { name: '💎・gem-trade', type: 0, topic: 'Transaksi batu permata / gem OwO.' },
                    { name: '🐾・pet-trade', type: 0, topic: 'Transaksi pet OwO.' },
                    { name: '📈・leaderboard', type: 0, topic: 'Leaderboard OwO.' },
                    { name: '🎁・daily', type: 0, topic: 'Klaim harian: `owo daily`.' },
                    { name: '🎲・gambling', type: 0, topic: 'Permainan judi: `owo slots`, `owo flip`.' },
                    { name: '📊・stats', type: 0, topic: 'Pengecekan statistik profil OwO.' },
                    { name: '📚・guides', type: 0, topic: 'Panduan lengkap cara bermain OwO.', isReadonly: true }
                ]
            },
            {
                category: '🏆 EVENTS',
                channels: [
                    { name: '🎉・giveaways', type: 0, topic: 'Bagi-bagi hadiah/giveaway.' },
                    { name: '🎯・missions', type: 0, topic: 'Misi-misi berhadiah dari staff.' },
                    { name: '🏅・hall-of-fame', type: 0, topic: 'Daftar pemenang dan member terbaik.', isReadonly: true },
                    { name: '🎁・rewards', type: 0, topic: 'Klaim hadiah pemenang event.' },
                    { name: '📢・results', type: 0, topic: 'Pengumuman hasil pemenang event.', isReadonly: true },
                    { name: '💬・event-chat', type: 0, topic: 'Obrolan khusus seputar event yang sedang berjalan.' }
                ]
            },
            {
                category: '💼 MARKETPLACE',
                channels: [
                    { name: '🛒・buy', type: 0, topic: 'Saluran untuk pembeli mencari item.' },
                    { name: '💸・sell', type: 0, topic: 'Saluran untuk penjual memasarkan item.' },
                    { name: '🔄・trade', type: 0, topic: 'Tukar tambah item sesama member.' },
                    { name: '📦・auction', type: 0, topic: 'Lelang item langka.' },
                    { name: '💎・rare-items', type: 0, topic: 'Pemasaran item langka / khusus.' },
                    { name: '⭐・verified-sellers', type: 0, topic: 'Daftar penjual terverifikasi server.', isReadonly: true }
                ]
            },
            {
                category: '🤝 SUPPORT',
                channels: [
                    { name: '🎫・create-ticket', type: 0, topic: 'Buka tiket untuk menghubungi Staff.' },
                    { name: '📩・support', type: 0, topic: 'Saluran bantuan cepat.' },
                    { name: '🚨・report-player', type: 0, topic: 'Laporkan pelaku kecurangan/toxic.' },
                    { name: '❓・questions', type: 0, topic: 'Tanya jawab seputar server.' },
                    { name: '💡・suggestions', type: 0, topic: 'Kirim saran dan kritik Anda di sini.' }
                ]
            },
            {
                category: '🤖 BOT',
                channels: [
                    { name: '🤖・commands', type: 0, topic: 'Pemberian perintah khusus bot.' },
                    { name: '📜・logs', type: 0, topic: 'Log aktivitas bot.', isLogs: true },
                    { name: '🔔・join-leave', type: 0, topic: 'Notifikasi join/leave server.' },
                    { name: '⚙️・bot-status', type: 0, topic: 'Status operasional bot.', isReadonly: true },
                    { name: '💾・backup', type: 0, topic: 'Informasi backup server.', isReadonly: true }
                ]
            },
            {
                category: '👑 STAFF',
                isStaffOnly: true,
                channels: [
                    { name: '📢・staff-announcements', type: 0, topic: 'Pengumuman khusus internal staff.', isReadonly: true },
                    { name: '💬・staff-chat', type: 0, topic: 'Saluran obrolan santai staff.', isStaffChat: true },
                    { name: '📋・applications', type: 0, topic: 'Pengajuan pendaftaran staff baru.' },
                    { name: '🚨・reports', type: 0, topic: 'Laporan pengaduan member masuk.' },
                    { name: '📝・tasks', type: 0, topic: 'Daftar tugas staff server.' },
                    { name: '🔒・archive', type: 0, topic: 'Arsip rahasia server.' }
                ]
            },
            {
                category: '🎙 VOICE',
                channels: [
                    { name: '🔊 General', type: 2 },
                    { name: '🔊 Chill', type: 2 },
                    { name: '🔊 Gaming', type: 2 },
                    { name: '🔊 Music', type: 2 },
                    { name: '🔊 Event', type: 2 },
                    { name: '😴 AFK', type: 2 }
                ]
            }
        ];

        // 3. Recreate Structure with specific permissions overrides
        const staffRoles = ['Owner', 'Developer', 'Server Manager', 'Head Admin', 'Admin', 'Moderator', 'Trial Moderator', 'Support Team', 'Event Team'];
        const adminRoles = ['Owner', 'Developer', 'Server Manager', 'Head Admin', 'Admin'];

        for (const catData of structure) {
            try {
                // Build Category Overwrites
                const catOverwrites = [];
                if (catData.isStaffOnly) {
                    catOverwrites.push({
                        id: targetGuild.id, // @everyone
                        deny: [PermissionFlagsBits.ViewChannel]
                    });
                    for (const sRole of staffRoles) {
                        if (roleMap[sRole]) {
                            catOverwrites.push({
                                id: roleMap[sRole],
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                            });
                        }
                    }
                }

                const category = await targetGuild.channels.create({
                    name: catData.category,
                    type: 4,
                    permissionOverwrites: catOverwrites
                });
                categoriesCreated++;

                for (const chanData of catData.channels) {
                    // Build Channel Specific Overwrites
                    const chanOverwrites = [];

                    if (chanData.isReadonly) {
                        chanOverwrites.push({
                            id: targetGuild.id, // @everyone
                            deny: [PermissionFlagsBits.SendMessages],
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                        });
                        for (const aRole of adminRoles) {
                            if (roleMap[aRole]) {
                                chanOverwrites.push({
                                    id: roleMap[aRole],
                                    allow: [PermissionFlagsBits.SendMessages]
                                });
                            }
                        }
                    } else if (chanData.isLogs) {
                        chanOverwrites.push({
                            id: targetGuild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel]
                        });
                        for (const sRole of staffRoles) {
                            if (roleMap[sRole]) {
                                chanOverwrites.push({
                                    id: roleMap[sRole],
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                                });
                            }
                        }
                    } else if (chanData.isStaffChat) {
                        chanOverwrites.push({
                            id: targetGuild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel]
                        });
                        // Allow Moderator, Admin, Owner (as specified in user requirements)
                        const chatAllowed = ['Owner', 'Developer', 'Server Manager', 'Head Admin', 'Admin', 'Moderator'];
                        for (const cRole of chatAllowed) {
                            if (roleMap[cRole]) {
                                chanOverwrites.push({
                                    id: roleMap[cRole],
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                                });
                            }
                        }
                    }

                    const channel = await targetGuild.channels.create({
                        name: chanData.name,
                        type: chanData.type,
                        topic: chanData.topic || '',
                        parent: category.id,
                        permissionOverwrites: chanOverwrites
                    });
                    channelMap[chanData.name] = channel.id;
                    channelsCreated++;
                }
            } catch (err) {
                console.error(`[AutoGen] Failed to create category/channel for ${catData.category}:`, err.message);
            }
        }

        // 4. Sync Welcome System to Database
        console.log('[AutoGen] Syncing Welcome & Goodbye systems for OwO Server...');
        const memberRoleId = roleMap['Member'] || null;

        await WelcomeConfig.findOneAndUpdate(
            { guildId: targetGuild.id },
            {
                channelId: channelMap['👋・welcome'] || null,
                autoRole: memberRoleId,
                enabled: true
            },
            { upsert: true }
        );

        await LeaveConfig.findOneAndUpdate(
            { guildId: targetGuild.id },
            {
                channelId: channelMap['🔔・join-leave'] || null,
                enabled: true
            },
            { upsert: true }
        );

        // 5. Deploy Verification Panel in 🎭・roles channel
        try {
            const rChannelId = channelMap['🎭・roles'];
            const rChannel = rChannelId ? await targetGuild.channels.fetch(rChannelId).catch(() => null) : null;
            if (rChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🔐 Verifikasi Akun')
                    .setDescription('Silakan klik tombol di bawah ini untuk memverifikasi akun Discord Anda dan mendapatkan role Member.\n\nDengan melakukan verifikasi, Anda setuju untuk mematuhi seluruh peraturan komunitas.')
                    .setColor('#00ff00');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('verify_btn').setLabel('Verifikasi Akun').setStyle(ButtonStyle.Success).setEmoji('✅')
                );
                await rChannel.send({ embeds: [embed], components: [row] });
            }
        } catch (e) {
            console.error('Failed verification panel deploy on OwO template:', e);
        }

        // 6. Deploy Ticket Support Panel in 🎫・create-ticket channel
        try {
            const tChannelId = channelMap['🎫・create-ticket'];
            const tChannel = tChannelId ? await targetGuild.channels.fetch(tChannelId).catch(() => null) : null;
            if (tChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🤝 OwO Community Support')
                    .setDescription('Butuh bantuan staff atau ada pertanyaan? Silakan klik tombol di bawah ini untuk membuat tiket bantuan baru.');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_support').setLabel('Support').setEmoji('🎫').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('ticket_report').setLabel('Report Player').setEmoji('🚨').setStyle(ButtonStyle.Danger)
                );
                await tChannel.send({ embeds: [embed], components: [row] });
            }
        } catch (e) {
            console.error('Failed ticket panel deploy on OwO template:', e);
        }
    }

    console.log(`[AutoGen] Generation finished for server: ${targetGuild.name}`);

    return {
        targetGuildName: targetGuild.name,
        rolesCreated,
        categoriesCreated,
        channelsCreated
    };
}

module.exports = {
    cloneGuild,
    wipeGuild,
    generateTemplate
};
