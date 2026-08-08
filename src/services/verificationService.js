const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const settingsService = require('./settingsService');
const Verification = require('../models/Verification');
const logger = require('../utils/logger');

const VERIFICATION_CHANNEL_ID = '1534987697351823512';
const VERIFIED_ROLE_ID = '1511190118109544608';

const QUESTION_POOL = [
    {
        id: 'q1',
        text: 'Apa tujuan Anda bergabung ke Server LyraBlox?',
        options: [
            { label: '🛒 Membeli kebutuhan Roblox', value: 'correct' },
            { label: '🎮 Hanya ingin melihat-lihat', value: 'wrong1' },
            { label: '📢 Ingin beriklan', value: 'wrong2' }
        ]
    },
    {
        id: 'q2',
        text: 'Apakah Anda bersedia mematuhi seluruh peraturan Server LyraBlox?',
        options: [
            { label: '✅ Ya, saya bersedia.', value: 'correct' },
            { label: '❌ Tidak.', value: 'wrong1' }
        ]
    },
    {
        id: 'q3',
        text: 'Sebelum melakukan pembelian, apa yang sebaiknya dilakukan?',
        options: [
            { label: '📖 Membaca informasi produk terlebih dahulu.', value: 'correct' },
            { label: '📨 DM seluruh Staff.', value: 'wrong1' },
            { label: '📢 Spam membuat Ticket.', value: 'wrong2' }
        ]
    }
];

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function syncPanel(client) {
    try {
        const channelId = await settingsService.get('verification_channel_id', VERIFICATION_CHANNEL_ID);
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            logger.warn(`[Verification] Channel ${channelId} tidak ditemukan.`);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🔐 Welcome to LyraBlox')
            .setDescription(
                'Selamat datang di Server LyraBlox.\n\n' +
                'Untuk mendapatkan akses ke seluruh Channel Server, silakan lakukan proses Verifikasi.\n\n' +
                'Verifikasi hanya membutuhkan waktu kurang dari satu menit.\n\n' +
                'Tekan tombol di bawah untuk memulai.'
            )
            .setColor('#3498db')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_start')
                .setLabel('✅ Verify')
                .setStyle(ButtonStyle.Success)
        );

        const savedMessageId = await settingsService.get('verification_panel_msg_id', null);
        if (savedMessageId) {
            try {
                const existing = await channel.messages.fetch(savedMessageId);
                if (existing && existing.author.id === client.user.id) {
                    await existing.edit({ embeds: [embed], components: [row] });
                    logger.info(`[Verification] Panel updated via edit() in #${channel.name}`);
                    return;
                }
            } catch (e) {
                // Not found
            }
        }

        // Cleanup old
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const oldMessages = messages.filter(m => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === 'verify_start')));
            for (const m of oldMessages.values()) await m.delete().catch(() => {});
        } catch (e) {}

        const sent = await channel.send({ embeds: [embed], components: [row] });
        await settingsService.set('verification_panel_msg_id', sent.id);
        logger.info(`[Verification] Panel created in #${channel.name}`);

    } catch (err) {
        logger.error('[Verification] Error syncing panel:', err);
    }
}

async function startVerification(interaction) {
    let doc = await Verification.findOne({ discordId: interaction.user.id });
    
    if (doc) {
        if (doc.verified) {
            return interaction.reply({ content: '✅ Anda sudah terverifikasi!', ephemeral: true });
        }
        if (doc.cooldownUntil && doc.cooldownUntil > new Date()) {
            const unixCooldown = Math.floor(doc.cooldownUntil.getTime() / 1000);
            return interaction.reply({ content: `Anda masih dalam masa tunggu.\nSilakan coba kembali:\n<t:${unixCooldown}:R>`, ephemeral: true });
        }
        if (doc.status === 'active') {
            const sessionAge = Date.now() - doc.lastAttempt.getTime();
            if (sessionAge < 15000) {
                // Prevent rapid button mashing (15 seconds cooldown)
                return interaction.reply({ content: '⚠️ Anda masih memiliki sesi verifikasi yang aktif. Silakan selesaikan atau tunggu hingga *timeout*.', ephemeral: true });
            }
            // If older than 15s, user probably lost the ephemeral message. We let them restart silently by overriding it.
        }
    } else {
        doc = new Verification({ discordId: interaction.user.id });
    }

    // Pick 3 random questions
    const shuffledPool = shuffleArray(QUESTION_POOL);
    const selectedQuestions = shuffledPool.slice(0, 3);
    
    const sessionData = {
        currentIndex: 0,
        questions: selectedQuestions.map(q => ({
            id: q.id,
            text: q.text,
            options: shuffleArray(q.options), // Shuffle answers
            selectedAnswer: null
        }))
    };

    doc.status = 'active';
    doc.activeSession = sessionData;
    doc.attempt += 1;
    doc.lastAttempt = new Date();
    await doc.save();

    await renderWizardStep(interaction, doc, true);
}

async function renderWizardStep(interaction, doc, isInitialReply = false) {
    const sessionData = doc.activeSession;
    const currentIndex = sessionData.currentIndex;

    if (currentIndex >= sessionData.questions.length) {
        return finalizeVerification(interaction, doc);
    }

    const currentQuestion = sessionData.questions[currentIndex];

    const embed = new EmbedBuilder()
        .setTitle('🔐 LyraBlox Verification')
        .setDescription(`**Question ${currentIndex + 1} / 3**\n\n${currentQuestion.text}`)
        .setColor('#3498db');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`verify_answer_${currentIndex}`)
        .setPlaceholder('Pilih jawaban Anda...');

    currentQuestion.options.forEach(opt => {
        selectMenu.addOptions({
            label: opt.label,
            value: opt.value
        });
    });

    const components = [new ActionRowBuilder().addComponents(selectMenu)];

    if (isInitialReply) {
        await interaction.reply({ embeds: [embed], components, ephemeral: true });
    } else {
        await interaction.update({ embeds: [embed], components });
    }
}

async function finalizeVerification(interaction, doc) {
    const sessionData = doc.activeSession;
    let isPassed = true;

    for (const q of sessionData.questions) {
        if (q.selectedAnswer !== 'correct') {
            isPassed = false;
            break;
        }
    }

    if (isPassed) {
        doc.status = 'passed';
        doc.verified = true;
        doc.verifiedAt = new Date();
        doc.activeSession = null;
        await doc.save();

        const member = interaction.member;
        if (member) {
            await member.roles.add(VERIFIED_ROLE_ID).catch(() => {});
        }

        const passEmbed = new EmbedBuilder()
            .setDescription('━━━━━━━━━━━━━━━━━━━━━━\n\n✅ **Verifikasi Berhasil**\n\nSelamat datang di LyraBlox.\nVerifikasi berhasil.\nRole telah diberikan.\nAnda sekarang dapat mengakses seluruh Channel Server.\nSelamat berbelanja.\n\n━━━━━━━━━━━━━━━━━━━━━━')
            .setColor('#2ecc71');
        return interaction.update({ embeds: [passEmbed], components: [] });
    } else {
        doc.status = 'failed';
        doc.cooldownUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        doc.activeSession = null;
        await doc.save();

        const unixCooldown = Math.floor(doc.cooldownUntil.getTime() / 1000);
        const failEmbed = new EmbedBuilder()
            .setDescription(`━━━━━━━━━━━━━━━━━━━━━━\n\n❌ **Verifikasi Gagal**\n\nJawaban Anda belum sesuai.\nSilakan coba kembali setelah:\n<t:${unixCooldown}:R>\n\nTerima kasih.\n\n━━━━━━━━━━━━━━━━━━━━━━`)
            .setColor('#e74c3c');
        return interaction.update({ embeds: [failEmbed], components: [] });
    }
}

module.exports = {
    syncPanel,
    startVerification,
    renderWizardStep,
    VERIFIED_ROLE_ID
};
