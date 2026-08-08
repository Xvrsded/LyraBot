const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const RobuxPackage = require('../models/RobuxPackage');
const CopayEligibility = require('../models/CopayEligibility');
const settingsService = require('./settingsService');
const logger = require('../utils/logger');

const COPAY_CHANNEL_ID = '1534576203116056817';
const COPAY_ANNOUNCEMENT_CHANNEL_ID = '1534984859825471629';

// Unique Custom IDs for persistent components
const BUTTON_IDS = {
    JOIN_COMMUNITY: 'copay_join_community',
    CHECK_STATUS: 'copay_check_status',
    ORDER: 'copay_order_now'
};

const ELIGIBLE_ROLE_ID = '1534989509857509426';

async function seedCopayPackages() {
    try {
        const copayCount = await RobuxPackage.countDocuments({ type: 'copay' });
        if (copayCount === 0) {
            const defaults = [
                { type: 'copay', amount: 100, price: 12500, sortOrder: 1 },
                { type: 'copay', amount: 200, price: 25000, sortOrder: 2 },
                { type: 'copay', amount: 300, price: 37500, sortOrder: 3 },
                { type: 'copay', amount: 400, price: 50000, sortOrder: 4 },
                { type: 'copay', amount: 500, price: 62500, sortOrder: 5 },
                { type: 'copay', amount: 600, price: 75000, sortOrder: 6 },
                { type: 'copay', amount: 700, price: 87500, sortOrder: 7 },
                { type: 'copay', amount: 800, price: 100000, sortOrder: 8 },
                { type: 'copay', amount: 900, price: 112500, sortOrder: 9 },
                { type: 'copay', amount: 1000, price: 125000, sortOrder: 10 }
            ];
            await RobuxPackage.insertMany(defaults);
            logger.info('[Copay Service] Seeded default Community Payout packages.');
        }
    } catch (err) {
        logger.error('[Copay Service] Error seeding packages:', err);
    }
}

function buildCopayEmbed() {
    const priceList =
        '100 Robux  = Rp12.500\n' +
        '200 Robux  = Rp25.000\n' +
        '300 Robux  = Rp37.500\n' +
        '400 Robux  = Rp50.000\n' +
        '500 Robux  = Rp62.500\n' +
        '600 Robux  = Rp75.000\n' +
        '700 Robux  = Rp87.500\n' +
        '800 Robux  = Rp100.000\n' +
        '900 Robux  = Rp112.500\n' +
        '1000 Robux = Rp125.000';

    const embed = new EmbedBuilder()
        .setTitle('💸 ROBUX COMMUNITY PAYOUT')
        .setDescription(
            'Robux akan dikirim menggunakan Roblox Community Payout.\n\n' +
            'Metode ini hanya dapat digunakan oleh Customer yang telah bergabung ke seluruh Community Roblox selama minimal **14 hari**.\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '📌 **WAJIB JOIN SELURUH COMMUNITY ROBLOX**\n\n' +
            '1️⃣ https://www.roblox.com/share/g/628192083\n' +
            '2️⃣ https://www.roblox.com/share/g/354576018\n' +
            '3️⃣ https://www.roblox.com/share/g/196386723\n' +
            '4️⃣ https://www.roblox.com/share/g/1061172752\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━'
        )
        .addFields(
            { name: '💰 PRICE LIST', value: '```text\n' + priceList + '\n```', inline: false },
            {
                name: '📝 Notes',
                value:
                    '• Wajib Join seluruh Community Roblox.\n' +
                    '• Minimal 14 Hari.\n' +
                    '• Seluruh Community wajib diikuti.\n' +
                    '• Setelah Eligible, Robux akan dikirim secara instan melalui Community Payout.',
                inline: false
            }
        )
        .setThumbnail('https://cdn.discordapp.com/icons/1473251746259402867/a_placeholder.png') // Will be replaced below
        .setColor('#2ecc71')
        .setFooter({ text: 'LyraBlox Community Payout' })
        .setTimestamp();

    return embed;
}

function buildCopayButtons() {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(BUTTON_IDS.JOIN_COMMUNITY)
            .setLabel('🌐 Join Community')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(BUTTON_IDS.CHECK_STATUS)
            .setLabel('📊 Cek Status Eligibility')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(BUTTON_IDS.ORDER)
            .setLabel('🛒 Order Payout')
            .setStyle(ButtonStyle.Success)
    );
    return [row1];
}

/**
 * Sync the Community Payout panel to its designated channel.
 * Uses edit-in-place if the panel message already exists, otherwise sends a new one.
 * Follows the same architecture as syncVilogPanel / syncVisendPanel / syncGigPanel.
 */
async function syncCopayPanel(client) {
    try {
        await seedCopayPackages();

        const channelId = await settingsService.get('copay_channel_id', COPAY_CHANNEL_ID);
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            logger.warn(`[Copay Service] Channel ${channelId} tidak ditemukan.`);
            return;
        }

        // Attempt to get the guild icon for thumbnail
        let thumbnailUrl = null;
        if (channel.guild) {
            const iconUrl = channel.guild.iconURL({ dynamic: true, size: 256 });
            if (iconUrl) thumbnailUrl = iconUrl;
        }

        const embed = buildCopayEmbed();
        if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

        const components = buildCopayButtons();

        // Check if we already have a saved panel message ID
        const savedMessageId = await settingsService.get('copay_panel_message_id', null);

        if (savedMessageId) {
            // Try to edit the existing message
            try {
                const existingMessage = await channel.messages.fetch(savedMessageId);
                if (existingMessage && existingMessage.author.id === client.user.id) {
                    await existingMessage.edit({ embeds: [embed], components });
                    logger.info(`[Copay Service] Panel updated via edit() in channel: #${channel.name}`);
                    return;
                }
            } catch (err) {
                // Message was deleted or not found, proceed to create new
                logger.warn(`[Copay Service] Saved panel message ${savedMessageId} not found, creating new panel.`);
            }
        }

        // Clean up any old copay panels left by the bot (anti-duplicate)
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const oldMessages = messages.filter(m =>
                m.author.id === client.user.id &&
                m.components.some(r =>
                    r.components.some(c => c.customId === BUTTON_IDS.ORDER || c.customId === BUTTON_IDS.VERIFY_JOIN)
                )
            );
            for (const m of oldMessages.values()) await m.delete().catch(() => {});
        } catch (err) {
            logger.warn('[Copay Service] Failed to clean up old panel messages:', err.message);
        }

        // Send a new panel
        const sentMessage = await channel.send({ embeds: [embed], components });
        await settingsService.set('copay_panel_message_id', sentMessage.id);
        logger.info(`[Copay Service] Panel created and sent to channel: #${channel.name} (msg: ${sentMessage.id})`);

    } catch (err) {
        logger.error('[Copay Service] Error syncing panel:', err);
    }
}

/**
 * Eligibility check cron handler - runs every 5 minutes.
 * Scans for waiting users whose eligibleAt has passed.
 */
async function handleEligibilityCheck(jobContext) {
    const { client } = jobContext;
    try {
        const now = new Date();
        const pendingEligible = await CopayEligibility.find({ status: 'waiting', eligibleAt: { $lte: now } });

        if (pendingEligible.length === 0) return;

        const announcementChannelId = await settingsService.get('copay_announcement_channel_id', COPAY_ANNOUNCEMENT_CHANNEL_ID);
        const announcementChannel = await client.channels.fetch(announcementChannelId).catch(() => null);

        for (const doc of pendingEligible) {
            try {
                const user = await client.users.fetch(doc.discordId).catch(() => null);

                // Assign Eligible Role
                if (ELIGIBLE_ROLE_ID) {
                    // Try all guilds the bot is in
                    for (const [, guild] of client.guilds.cache) {
                        try {
                            const member = await guild.members.fetch(doc.discordId).catch(() => null);
                            if (member) {
                                await member.roles.add(ELIGIBLE_ROLE_ID).catch(err =>
                                    logger.error(`[Copay] Failed to assign role to ${doc.discordUsername}:`, err.message)
                                );
                                doc.roleGranted = true;
                                break;
                            }
                        } catch (e) { /* skip guild */ }
                    }
                }

                // Send DM
                if (user) {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('🎉 Selamat!')
                        .setDescription(
                            '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                            'Anda sekarang telah memenuhi syarat untuk menggunakan Robux Community Payout.\n\n' +
                            'Silakan kembali ke Channel Store dan lakukan Order.\n\n' +
                            'Terima kasih telah menunggu.\n\n' +
                            '━━━━━━━━━━━━━━━━━━━━━━'
                        )
                        .setColor('#2ecc71');
                    await user.send({ embeds: [dmEmbed] }).catch(() => {});
                }

                // Announcement
                if (announcementChannel) {
                    const announcementEmbed = new EmbedBuilder()
                        .setTitle('🎉 CUSTOMER BARU ELIGIBLE')
                        .setDescription(
                            '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                            `👤 **Discord**\n<@${doc.discordId}>\n\n` +
                            `👤 **Roblox**\n${doc.robloxUsername}\n\n` +
                            `📅 **Mulai Perhitungan**\n<t:${Math.floor(doc.startedAt.getTime() / 1000)}:F>\n\n` +
                            `✅ **Eligible**\n<t:${Math.floor(now.getTime() / 1000)}:F>\n\n` +
                            '━━━━━━━━━━━━━━━━━━━━━━'
                        )
                        .addFields({ name: 'Status', value: '🟢 ELIGIBLE' })
                        .setColor('#00ff00')
                        .setTimestamp();

                    await announcementChannel.send({ embeds: [announcementEmbed] }).catch(() => {});
                    doc.announcementSent = true;
                }

                doc.status = 'eligible';
                await doc.save();
                logger.info(`[Copay Service] Marked ${doc.discordUsername} as eligible.`);

            } catch (innerErr) {
                logger.error(`[Copay Service] Error processing eligibility for ${doc.discordId}:`, innerErr);
            }
        }
    } catch (err) {
        logger.error('[Copay Service] Error in eligibility check cron:', err);
    }
}

module.exports = {
    seedCopayPackages,
    syncCopayPanel,
    handleEligibilityCheck,
    BUTTON_IDS
};
