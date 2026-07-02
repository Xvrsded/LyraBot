const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const OnboardingAnalytics = require('../../models/OnboardingAnalytics');
const MemberIdentity = require('../../models/MemberIdentity');
const onboardingManager = require('../../services/onboardingManager');
const configService = require('../../services/configService');
const welcomeRenderer = require('../../services/welcomeRenderer');
const interactionRouter = require('../../handlers/interactionRouter');
const { COLORS } = require('../../utils/constants');
const logger = require('../../utils/logger');

// 1. Button Verify Route
interactionRouter.registerButton('onboarding:verify_btn:', async (interaction) => {
    const targetUserId = interaction.customId.split(':')[2];
    const isOwner = interaction.user.id === targetUserId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) {
        return interaction.reply({ content: '❌ Tombol verifikasi ini hanya untuk pengguna terkait.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const guildId = interaction.guildId;
        const targetMember = await interaction.guild.members.fetch(targetUserId);
        const identity = await MemberIdentity.findOne({ guildId, userId: targetUserId });
        const config = await configService.getConfig(guildId);

        if (!identity) {
            return interaction.editReply('❌ Data identitas Anda tidak ditemukan.');
        }

        if (identity.status === 'active') {
            return interaction.editReply('🟢 Anda sudah terverifikasi.');
        }

        // Complete onboarding
        await onboardingManager.completeOnboarding(targetMember, identity, config);
        
        // Disable original button message if possible
        if (interaction.message && isOwner) {
            await interaction.message.delete().catch(() => null);
        }

        await interaction.editReply('✅ Verifikasi berhasil! Peran Anda telah diberikan.');
    } catch (err) {
        logger.error('[Onboarding Verify Button Error]', err);
        await interaction.editReply(`❌ Gagal memproses verifikasi: ${err.message}`);
    }
});

// 2. Button Request Captcha Route
interactionRouter.registerButton('onboarding:captcha_req:', async (interaction) => {
    const targetUserId = interaction.customId.split(':')[2];
    const isOwner = interaction.user.id === targetUserId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) {
        return interaction.reply({ content: '❌ Captcha ini hanya untuk pengguna terkait.', ephemeral: true });
    }

    // Generate random 5-character code
    const captchaCode = Math.random().toString(36).substring(2, 7).toUpperCase();

    const modal = new ModalBuilder()
        .setCustomId(`onboarding:captcha_modal:${targetUserId}:${captchaCode}`)
        .setTitle('🧩 Captcha Verification');

    const input = new TextInputBuilder()
        .setCustomId('captcha_input')
        .setLabel(`Ketik kode berikut secara persis: ${captchaCode}`)
        .setPlaceholder(captchaCode)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(5);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
});

// 3. Modal Submit Captcha Route
interactionRouter.registerModal('onboarding:captcha_modal:', async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const parts = interaction.customId.split(':');
    const targetUserId = parts[2];
    const expectedCode = parts[3];
    const userInput = interaction.fields.getTextInputValue('captcha_input').toUpperCase();

    if (userInput !== expectedCode) {
        // Increment attempts in DB
        await MemberIdentity.findOneAndUpdate(
            { guildId: interaction.guildId, userId: targetUserId },
            { $inc: { verificationAttempts: 1 } }
        );
        return interaction.editReply('❌ **Captcha Salah!** Silakan klik tombol kembali untuk meminta captcha baru.');
    }

    try {
        const guildId = interaction.guildId;
        const targetMember = await interaction.guild.members.fetch(targetUserId);
        const identity = await MemberIdentity.findOne({ guildId, userId: targetUserId });
        const config = await configService.getConfig(guildId);

        if (!identity) {
            return interaction.editReply('❌ Data identitas Anda tidak ditemukan.');
        }

        // Complete onboarding
        await onboardingManager.completeOnboarding(targetMember, identity, config);

        // Delete captcha prompt message
        if (interaction.message) {
            await interaction.message.delete().catch(() => null);
        }

        await interaction.editReply('✅ **Captcha Benar!** Verifikasi sukses dan akun Anda telah aktif.');
    } catch (err) {
        logger.error('[Onboarding Captcha Submit Error]', err);
        await interaction.editReply(`❌ Gagal menyelesaikan verifikasi: ${err.message}`);
    }
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('onboarding')
        .setDescription('Identity and Onboarding lifecycle framework')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Subcommand: status
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Tampilkan analitik retention join dan verifikasi')
        )
        // Subcommand: preview
        .addSubcommand(sub =>
            sub.setName('preview')
                .setDescription('Simulasikan tampilan rendering pesan welcome')
        )
        // Subcommand: verify
        .addSubcommand(sub =>
            sub.setName('verify')
                .setDescription('Kirim tombol verifikasi manual ke saluran saat ini')
                .addUserOption(opt =>
                    opt.setName('member')
                        .setDescription('Member yang ingin diverifikasi')
                        .setRequired(true)
                )
        ),

    /**
     * Executes the `/onboarding` slash commands.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction
     */
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            await interaction.deferReply({ ephemeral: true });
            const guildId = interaction.guildId;

            const analytics = await OnboardingAnalytics.find({ guildId });
            
            let totalJoins = 0;
            let totalLeaves = 0;
            let totalVerified = 0;
            let totalDurationMs = 0;

            analytics.forEach(day => {
                totalJoins += day.joins;
                totalLeaves += day.leaves;
                totalVerified += day.verifiedCount;
                totalDurationMs += day.totalVerificationTimeMs;
            });

            const successRate = totalJoins > 0 ? Math.round((totalVerified / totalJoins) * 100) : 0;
            const avgTimeSeconds = totalVerified > 0 ? Math.round((totalDurationMs / totalVerified) / 1000) : 0;
            const retentionRate = totalJoins > 0 ? Math.round(((totalJoins - totalLeaves) / totalJoins) * 100) : 0;

            const embed = new EmbedBuilder()
                .setTitle('👥 Onboarding & Join Analytics')
                .setDescription('Hasil rekapitulasi data retention member baru.')
                .setColor(COLORS.DEFAULT)
                .addFields(
                    { name: '📈 Joins (Total)', value: `\`${totalJoins}\` member`, inline: true },
                    { name: '📉 Leaves (Total)', value: `\`${totalLeaves}\` member`, inline: true },
                    { name: '🌱 Net Growth', value: `\`${totalJoins - totalLeaves}\` member`, inline: true },
                    { name: '✅ Verified Count', value: `\`${totalVerified}\` member`, inline: true },
                    { name: '🎯 Verification Success Rate', value: `\`${successRate}%\``, inline: true },
                    { name: '⏱️ Avg. Verification Duration', value: `\`${avgTimeSeconds} detik\``, inline: true },
                    { name: '🔄 Server Retention Rate', value: `\`${retentionRate}%\``, inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'preview') {
            await interaction.deferReply({ ephemeral: true });
            const guildId = interaction.guildId;
            const config = await configService.getConfig(guildId);
            const welcomeConfig = config.welcome;

            if (!welcomeConfig || !welcomeConfig.enabled) {
                return interaction.editReply('⚠️ Fitur welcome saat ini dinonaktifkan dalam konfigurasi server.');
            }

            const welcomePayload = welcomeRenderer.renderWelcomePayload(interaction.member, welcomeConfig);
            return interaction.editReply({
                content: `👀 **Welcome Message Preview:**\n*Dikirim di <#${config.channels?.welcome}>*`,
                embeds: welcomePayload.embeds
            });
        }

        if (subcommand === 'verify') {
            await interaction.deferReply({ ephemeral: true });
            const guildId = interaction.guildId;
            const targetUser = interaction.options.getUser('member');
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                return interaction.editReply('❌ Member tidak ditemukan di server.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🔒 Manual Verification Prompt')
                .setDescription(`Tindakan verifikasi diperlukan untuk ${targetUser}. Klik tombol di bawah untuk menyetujui.`)
                .setColor(COLORS.WARNING);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`onboarding:verify_btn:${targetUser.id}`)
                    .setLabel('Setujui & Verifikasi')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.editReply(`🟢 Tombol verifikasi manual untuk ${targetUser} berhasil dikirim.`);
        }
    }
};
