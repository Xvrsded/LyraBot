const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const AuditEntry = require('../../models/AuditEntry');
const auditService = require('../../services/auditService');
const auditExporter = require('../../services/auditExporter');
const { COLORS } = require('../../utils/constants');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audit')
        .setDescription('Enterprise Audit Log search and management panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Subcommand: search
        .addSubcommand(sub =>
            sub.setName('search')
                .setDescription('Cari catatan audit log berdasarkan filter kustom')
                .addStringOption(opt => opt.setName('severity').setDescription('Tingkat keparahan log').setRequired(false).addChoices(
                    { name: 'Info', value: 'Info' },
                    { name: 'Warning', value: 'Warning' },
                    { name: 'Error', value: 'Error' },
                    { name: 'Critical', value: 'Critical' },
                    { name: 'Security', value: 'Security' }
                ))
                .addStringOption(opt => opt.setName('plugin').setDescription('Filter asal plugin').setRequired(false))
                .addStringOption(opt => opt.setName('action').setDescription('Filter nama aksi').setRequired(false))
                .addUserOption(opt => opt.setName('user').setDescription('Filter pelaku (user)').setRequired(false))
                .addUserOption(opt => opt.setName('target').setDescription('Filter target').setRequired(false))
                .addStringOption(opt => opt.setName('correlation_id').setDescription('Filter ID Korelasi').setRequired(false))
        )
        // Subcommand: export
        .addSubcommand(sub =>
            sub.setName('export')
                .setDescription('Ekspor catatan audit log (maks 200 entri) ke CSV atau JSON')
                .addStringOption(opt =>
                    opt.setName('format')
                        .setDescription('Format dokumen ekspor')
                        .setRequired(true)
                        .addChoices(
                            { name: 'JSON Document', value: 'json' },
                            { name: 'CSV Spreadsheet', value: 'csv' }
                        )
                )
        )
        // Subcommand: retention
        .addSubcommand(sub =>
            sub.setName('retention')
                .setDescription('Atur batas waktu penyimpanan log otomatis di database')
                .addIntegerOption(opt =>
                    opt.setName('days')
                        .setDescription('Durasi penyimpanan (hari)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(365)
                )
        )
        // Subcommand: live (matches `/logs live`)
        .addSubcommand(sub =>
            sub.setName('live')
                .setDescription('Tampilkan 15 aktivitas log audit terbaru secara langsung')
        ),

    /**
     * Executes `/audit` slash commands.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'search') {
            const severity = interaction.options.getString('severity');
            const plugin = interaction.options.getString('plugin');
            const action = interaction.options.getString('action');
            const filterUser = interaction.options.getUser('user');
            const filterTarget = interaction.options.getUser('target');
            const corrId = interaction.options.getString('correlation_id');

            // Build dynamic database query
            const query = { guildId };
            if (severity) query.severity = severity;
            if (plugin) query.plugin = new RegExp(plugin, 'i');
            if (action) query.action = new RegExp(action, 'i');
            if (filterUser) query.userId = filterUser.id;
            if (filterTarget) query.targetId = filterTarget.id;
            if (corrId) query.correlationId = corrId;

            const entries = await AuditEntry.find(query).sort({ timestamp: -1 }).limit(10);

            const embed = new EmbedBuilder()
                .setTitle('🔍 Audit Log Search Results')
                .setDescription('Menampilkan 10 hasil pencarian log audit terbaru sesuai filter.')
                .setColor(COLORS.DEFAULT)
                .setTimestamp();

            if (entries.length === 0) {
                embed.setDescription('*Tidak ada catatan log audit yang cocok.*');
            } else {
                entries.forEach((e, idx) => {
                    const statusEmoji = e.severity === 'Security' ? '🔒' : (e.severity === 'Error' || e.severity === 'Critical' ? '🔴' : (e.severity === 'Warning' ? '🟡' : '🟢'));
                    embed.addFields({
                        name: `#${idx + 1} - ${statusEmoji} ${e.action} [${e.severity}]`,
                        value: `• Plugin: \`plugin:${e.plugin}\`\n• Correlation ID: \`${e.correlationId}\`\n• Pelaku: ${e.userId ? `<@${e.userId}>` : '`-`'}\n• Waktu: <t:${Math.round(e.timestamp.getTime() / 1000)}:R>`,
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'export') {
            const format = interaction.options.getString('format');

            // Retrieve last 200 logs
            const entries = await AuditEntry.find({ guildId }).sort({ timestamp: -1 }).limit(200);

            let buffer;
            let filename;

            if (format === 'csv') {
                const csvData = auditExporter.toCSV(entries);
                buffer = Buffer.from(csvData, 'utf-8');
                filename = 'audit_log_export.csv';
            } else {
                const jsonData = auditExporter.toJSON(entries);
                buffer = Buffer.from(jsonData, 'utf-8');
                filename = 'audit_log_export.json';
            }

            const attachment = new AttachmentBuilder(buffer, { name: filename });
            return interaction.editReply({
                content: `✅ **Ekspor sukses!** Berhasil mengekspor \`${entries.length}\` log ke format **${format.toUpperCase()}**.`,
                files: [attachment]
            });
        }

        if (subcommand === 'retention') {
            const days = interaction.options.getInteger('days');
            auditService.defaultRetentionDays = days;

            return interaction.editReply(`🟢 **Kebijakan Retensi Diperbarui**: Log audit sekarang akan otomatis dihapus setelah **${days} hari**.`);
        }

        if (subcommand === 'live') {
            const entries = await AuditEntry.find({ guildId }).sort({ timestamp: -1 }).limit(15);

            const embed = new EmbedBuilder()
                .setTitle('📋 Live Audit Log tail (Last 15)')
                .setDescription('Daftar log aktivitas bot terbaru di server.')
                .setColor(COLORS.DEFAULT)
                .setTimestamp();

            if (entries.length === 0) {
                embed.setDescription('*Tidak ada log yang tercatat.*');
            } else {
                entries.forEach((e, idx) => {
                    const statusEmoji = e.severity === 'Security' ? '🔒' : (e.severity === 'Error' ? '🔴' : (e.severity === 'Warning' ? '🟡' : '🟢'));
                    const age = Math.round((Date.now() - e.timestamp.getTime()) / 1000);
                    embed.addFields({
                        name: `#${idx + 1} - ${statusEmoji} ${e.action} [${e.severity}]`,
                        value: `• Origin: \`plugin:${e.plugin}\` | Correlation: \`${e.correlationId}\`\n• Waktu: \`${age}s ago\` | Pelaku: <@${e.userId || 'core'}>`,
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
