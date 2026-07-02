const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ScheduledJob = require('../../models/ScheduledJob');
const JobHistory = require('../../models/JobHistory');
const jobManager = require('../../services/jobManager');
const scheduler = require('../../services/scheduler');
const { COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jobs')
        .setDescription('Centralized scheduling and task management system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Subcommand: List
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Tampilkan seluruh tugas background dan metrik performa')
        )
        // Subcommand: History
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('Tampilkan 10 riwayat eksekusi pekerjaan terakhir')
        )
        // Subcommand: Pause
        .addSubcommand(subcommand =>
            subcommand
                .setName('pause')
                .setDescription('Jeda eksekusi pekerjaan latar belakang')
                .addStringOption(option =>
                    option.setName('job_name')
                        .setDescription('Nama pekerjaan yang ingin dijeda')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        // Subcommand: Resume
        .addSubcommand(subcommand =>
            subcommand
                .setName('resume')
                .setDescription('Lanjutkan eksekusi pekerjaan latar belakang yang dijeda')
                .addStringOption(option =>
                    option.setName('job_name')
                        .setDescription('Nama pekerjaan yang ingin dilanjutkan')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        // Subcommand: Cancel
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Batalkan dan hapus pekerjaan latar belakang')
                .addStringOption(option =>
                    option.setName('job_name')
                        .setDescription('Nama pekerjaan yang ingin dihapus')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    /**
     * Handles autocomplete requests for job names.
     * @param {AutocompleteInteraction} interaction Discord Autocomplete Interaction
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        try {
            const jobs = await ScheduledJob.find({
                name: { $regex: focusedValue, $options: 'i' }
            }).limit(25);

            await interaction.respond(
                jobs.map(job => ({ name: `${job.name} (${job.type})`, value: job.name }))
            );
        } catch (err) {
            await interaction.respond([]);
        }
    },

    /**
     * Executes the `/jobs` slash commands.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'list') {
            const jobs = await ScheduledJob.find();
            
            const total = scheduler.metrics.totalRuns;
            const avgRuntime = total > 0 ? Math.round(scheduler.metrics.totalExecutionTimeMs / total) : 0;

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Centralized Scheduler Performance')
                .setDescription('Statistik dan metrik performa pekerjaan latar belakang.')
                .setColor(COLORS.DEFAULT)
                .addFields(
                    { name: '📊 Total Run', value: `\`${total}\` kali`, inline: true },
                    { name: '🟢 Success', value: `\`${scheduler.metrics.successfulRuns}\` kali`, inline: true },
                    { name: '🔴 Failed', value: `\`${scheduler.metrics.failedRuns}\` kali`, inline: true },
                    { name: '⏱️ Avg. Runtime', value: `\`${avgRuntime} ms\``, inline: true }
                )
                .setTimestamp();

            if (jobs.length === 0) {
                embed.addFields({ name: 'Daftar Pekerjaan', value: '*Tidak ada pekerjaan yang terdaftar.*' });
            } else {
                jobs.forEach(job => {
                    const nextRun = job.nextRunAt ? `<t:${Math.round(job.nextRunAt.getTime() / 1000)}:R>` : '`-`';
                    const hasHandler = jobManager.handlers.has(job.name) ? '✅ Handler Active' : '⚠️ No Handler (Disabled)';
                    
                    let statusEmoji = '🟢';
                    if (job.status === 'paused') statusEmoji = '🟡';
                    if (job.status === 'failed') statusEmoji = '🔴';
                    if (job.status === 'completed') statusEmoji = '🔵';

                    embed.addFields({
                        name: `${statusEmoji} ${job.name} [${job.type}]`,
                        value: `• Pattern: \`${job.pattern || 'None'}\`\n• Status: **${job.status}** (${hasHandler})\n• Next Run: ${nextRun}`,
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'history') {
            const histories = await JobHistory.find().sort({ createdAt: -1 }).limit(10);

            const embed = new EmbedBuilder()
                .setTitle('📜 Job Run History (Last 10)')
                .setColor(COLORS.INFO)
                .setTimestamp();

            if (histories.length === 0) {
                embed.setDescription('*Tidak ada riwayat pekerjaan saat ini.*');
            } else {
                histories.forEach((hist, idx) => {
                    const statusEmoji = hist.status === 'success' ? '🟢' : '🔴';
                    const retryText = hist.retryAttempt > 0 ? ` (Retry #${hist.retryAttempt})` : '';
                    const durationText = `${hist.durationMs}ms`;
                    const timeText = `<t:${Math.round(hist.createdAt.getTime() / 1000)}:R>`;

                    embed.addFields({
                        name: `#${idx + 1} - ${statusEmoji} ${hist.jobName}${retryText}`,
                        value: `• Status: **${hist.status}**\n• Durasi: \`${durationText}\`\n• Waktu: ${timeText}` + (hist.error ? `\n• Error: *${hist.error}*` : ''),
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        const jobName = interaction.options.getString('job_name');

        if (subcommand === 'pause') {
            const success = await jobManager.pauseJob(jobName);
            if (!success) return interaction.editReply(`❌ Pekerjaan \`${jobName}\` tidak ditemukan.`);
            return interaction.editReply(`🟢 Pekerjaan \`${jobName}\` berhasil dijeda.`);
        }

        if (subcommand === 'resume') {
            const success = await jobManager.resumeJob(jobName);
            if (!success) return interaction.editReply(`❌ Pekerjaan \`${jobName}\` tidak ditemukan.`);
            return interaction.editReply(`🟢 Pekerjaan \`${jobName}\` berhasil dilanjutkan.`);
        }

        if (subcommand === 'cancel') {
            const success = await jobManager.cancelJob(jobName);
            if (!success) return interaction.editReply(`❌ Pekerjaan \`${jobName}\` tidak ditemukan.`);
            return interaction.editReply(`🟢 Pekerjaan \`${jobName}\` berhasil dibatalkan dan dihapus.`);
        }
    }
};
