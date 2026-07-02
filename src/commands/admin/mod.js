const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const moderationEngine = require('../../services/moderationEngine');
const ModerationCase = require('../../models/ModerationCase');
const ModerationAppeal = require('../../models/ModerationAppeal');
const eventBus = require('../../services/eventBus');
const { COLORS } = require('../../utils/constants');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Enterprise Centralized Moderation Engine')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        // Subcommand: warn
        .addSubcommand(sub =>
            sub.setName('warn')
                .setDescription('Berikan peringatan formal kepada member')
                .addUserOption(opt => opt.setName('member').setDescription('Target member').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Alasan peringatan').setRequired(true))
        )
        // Subcommand: kick
        .addSubcommand(sub =>
            sub.setName('kick')
                .setDescription('Tendang member keluar dari server')
                .addUserOption(opt => opt.setName('member').setDescription('Target member').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Alasan penendangan').setRequired(true))
        )
        // Subcommand: ban
        .addSubcommand(sub =>
            sub.setName('ban')
                .setDescription('Blokir member secara permanen dari server')
                .addUserOption(opt => opt.setName('member').setDescription('Target member').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Alasan pemblokiran').setRequired(false))
        )
        // Subcommand: timeout
        .addSubcommand(sub =>
            sub.setName('timeout')
                .setDescription('Bisukan member sementara (Timeout)')
                .addUserOption(opt => opt.setName('member').setDescription('Target member').setRequired(true))
                .addIntegerOption(opt => opt.setName('duration').setDescription('Durasi timeout dalam menit').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Alasan timeout').setRequired(false))
        )
        // Subcommand: history
        .addSubcommand(sub =>
            sub.setName('history')
                .setDescription('Tampilkan riwayat moderasi lengkap untuk target')
                .addUserOption(opt => opt.setName('member').setDescription('Filter berdasarkan target').setRequired(false))
                .addUserOption(opt => opt.setName('moderator').setDescription('Filter berdasarkan moderator').setRequired(false))
        )
        // Subcommand: case
        .addSubcommand(sub =>
            sub.setName('case')
                .setDescription('Tampilkan rincian kasus moderasi berdasarkan nomor kasus')
                .addIntegerOption(opt => opt.setName('case_number').setDescription('Nomor Kasus').setRequired(true))
        )
        // Subcommand: appeal_submit
        .addSubcommand(sub =>
            sub.setName('appeal_submit')
                .setDescription('Ajukan banding atas kasus penalti moderasi Anda')
                .addIntegerOption(opt => opt.setName('case_number').setDescription('Nomor Kasus').setRequired(true))
                .addStringOption(opt => opt.setName('statement').setDescription('Pernyataan alasan banding').setRequired(true))
        )
        // Subcommand: appeal_resolve
        .addSubcommand(sub =>
            sub.setName('appeal_resolve')
                .setDescription('Setujui atau tolak pengajuan banding kasus')
                .addIntegerOption(opt => opt.setName('case_number').setDescription('Nomor Kasus').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('decision')
                        .setDescription('Keputusan keputusan banding')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Setujui (Approve & Unban)', value: 'approved' },
                            { name: 'Tolak (Reject)', value: 'rejected' }
                        )
                )
                .addStringOption(opt => opt.setName('notes').setDescription('Catatan tambahan resolusi').setRequired(false))
        ),

    /**
     * Executes `/mod` slash subcommands.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const moderator = interaction.member;

        // Route warn, kick, ban, timeout actions through centralized ModerationEngine
        if (['warn', 'kick', 'ban', 'timeout'].includes(subcommand)) {
            const targetUser = interaction.options.getUser('member');
            const reason = interaction.options.getString('reason') || 'Tidak ada alasan.';
            
            let action = '';
            let durationMs = null;

            if (subcommand === 'warn') action = 'WARN';
            if (subcommand === 'kick') action = 'KICK';
            if (subcommand === 'ban') action = 'BAN';
            if (subcommand === 'timeout') {
                action = 'TIMEOUT';
                const minutes = interaction.options.getInteger('duration');
                durationMs = minutes * 60 * 1000;
            }

            try {
                const result = await moderationEngine.executeAction(guild, {
                    action,
                    targetId: targetUser.id,
                    moderator,
                    reason,
                    durationMs
                });
                return interaction.editReply(result.summary);
            } catch (err) {
                return interaction.editReply(`❌ **Gagal mengeksekusi tindakan**: ${err.message}`);
            }
        }

        if (subcommand === 'history') {
            const filterTarget = interaction.options.getUser('member');
            const filterMod = interaction.options.getUser('moderator');

            const query = { guildId: guild.id };
            if (filterTarget) query.targetId = filterTarget.id;
            if (filterMod) query.moderatorId = filterMod.id;

            const cases = await ModerationCase.find(query).sort({ caseNumber: -1 }).limit(10);

            const embed = new EmbedBuilder()
                .setTitle('📜 Moderation History logs')
                .setColor(COLORS.DEFAULT)
                .setTimestamp();

            if (cases.length === 0) {
                embed.setDescription('*Tidak ada riwayat tindakan moderasi ditemukan.*');
            } else {
                cases.forEach(c => {
                    embed.addFields({
                        name: `Kasus #${c.caseNumber} - ${c.action}`,
                        value: `• Target: <@${c.targetId}> (${c.targetTag})\n• Moderator: <@${c.moderatorId}>\n• Alasan: *${c.reason}*\n• Tanggal: <t:${Math.round(c.timestamp.getTime() / 1000)}:d>`,
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'case') {
            const caseNumber = interaction.options.getInteger('case_number');
            const c = await ModerationCase.findOne({ guildId: guild.id, caseNumber });

            if (!c) {
                return interaction.editReply(`❌ Kasus #${caseNumber} tidak ditemukan.`);
            }

            const embed = new EmbedBuilder()
                .setTitle(`🚨 Detail Kasus #${c.caseNumber}`)
                .setColor(COLORS.INFO)
                .addFields(
                    { name: '🚨 Tindakan', value: `\`${c.action}\``, inline: true },
                    { name: '🆔 Correlation ID', value: `\`${c.correlationId}\``, inline: true },
                    { name: '👤 Target', value: `<@${c.targetId}> (${c.targetTag})`, inline: true },
                    { name: '👨💼 Moderator', value: `<@${c.moderatorId}> (${c.moderatorTag})`, inline: true },
                    { name: '📝 Alasan', value: c.reason, inline: false },
                    { name: '🕒 Waktu Kejadian', value: `<t:${Math.round(c.timestamp.getTime() / 1000)}:F>`, inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'appeal_submit') {
            const caseNumber = interaction.options.getInteger('case_number');
            const statement = interaction.options.getString('statement');

            const modCase = await ModerationCase.findOne({ guildId: guild.id, caseNumber });
            if (!modCase) {
                return interaction.editReply(`❌ Kasus #${caseNumber} tidak ditemukan.`);
            }

            // Verify if the user trying to appeal is indeed the target of the case
            if (modCase.targetId !== interaction.user.id) {
                return interaction.editReply('❌ Anda hanya dapat mengajukan banding atas kasus hukuman Anda sendiri.');
            }

            try {
                await ModerationAppeal.findOneAndUpdate(
                    { guildId: guild.id, caseNumber },
                    {
                        userId: interaction.user.id,
                        userTag: interaction.user.tag,
                        statement,
                        status: 'pending'
                    },
                    { upsert: true }
                );

                eventBus.emit('moderation.appealed', { caseNumber, userId: interaction.user.id }, { plugin: 'moderation', guildId: guild.id, userId: interaction.user.id });

                return interaction.editReply(`🟢 Pengajuan banding untuk **Kasus #${caseNumber}** berhasil disubmit. Tim admin kami akan meninjau banding Anda.`);
            } catch (err) {
                return interaction.editReply(`❌ Gagal menyimpan pengajuan banding: ${err.message}`);
            }
        }

        if (subcommand === 'appeal_resolve') {
            const caseNumber = interaction.options.getInteger('case_number');
            const decision = interaction.options.getString('decision'); // approved, rejected
            const notes = interaction.options.getString('notes') || 'Tidak ada catatan tambahan.';

            // Verify admin permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply('❌ Anda membutuhkan hak akses Administrator untuk menyetujui/menolak banding.');
            }

            const appeal = await ModerationAppeal.findOne({ guildId: guild.id, caseNumber });
            if (!appeal) {
                return interaction.editReply(`❌ Pengajuan banding untuk Kasus #${caseNumber} tidak ditemukan.`);
            }

            const modCase = await ModerationCase.findOne({ guildId: guild.id, caseNumber });

            try {
                appeal.status = decision;
                appeal.moderatorNote = notes;
                appeal.resolvedBy = interaction.user.id;
                await appeal.save();

                let resultMsg = `🟢 Banding untuk Kasus #${caseNumber} telah disetujui (Status: **${decision}**).`;

                // If approved and the original action was BAN, automatically trigger UNBAN!
                if (decision === 'approved' && modCase && modCase.action === 'BAN') {
                    await guild.members.unban(modCase.targetId, `Appeal approved by ${interaction.user.tag}`).catch(err => {
                        logger.error(`[Mod Appeal] Failed to unban user ${modCase.targetId} on appeal approval:`, err.message);
                        resultMsg += ` (⚠️ Gagal melepas pemblokiran otomatis: ${err.message})`;
                    });
                }

                return interaction.editReply(resultMsg);
            } catch (err) {
                return interaction.editReply(`❌ Gagal meresolusi pengajuan banding: ${err.message}`);
            }
        }
    }
};
