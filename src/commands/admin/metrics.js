const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const metricsService = require('../../services/metricsService');
const pluginManager = require('../../services/pluginManager');
const interactionRouter = require('../../handlers/interactionRouter');
const { COLORS } = require('../../utils/constants');
const logger = require('../../utils/logger');

// Register Export JSON button route
interactionRouter.registerButton('metrics:export_json', async (interaction) => {
    try {
        const jsonDump = metricsService.exportJSON(interaction.client);
        const buffer = Buffer.from(jsonDump, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: 'telemetry_export.json' });
        
        await interaction.reply({
            content: '📋 **Data telemetri lengkap berhasil diekspor:**',
            files: [attachment],
            ephemeral: true
        });
    } catch (err) {
        logger.error('[Metrics Export Error]', err);
        await interaction.reply({ content: `❌ Gagal mengekspor data: ${err.message}`, ephemeral: true });
    }
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('metrics')
        .setDescription('System telemetry and performance indicators')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Subcommand: general
        .addSubcommand(sub =>
            sub.setName('general')
                .setDescription('Tampilkan performa umum bot (CPU, Memori, DB, Cache)')
        )
        // Subcommand: plugin
        .addSubcommand(sub =>
            sub.setName('plugin')
                .setDescription('Tampilkan statistik performa spesifik per plugin')
                .addStringOption(opt =>
                    opt.setName('plugin_name')
                        .setDescription('Nama plugin yang ingin diperiksa')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    /**
     * Handles autocomplete requests for plugin names.
     * @param {AutocompleteInteraction} interaction Discord Autocomplete Interaction
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        try {
            const plugins = Array.from(pluginManager.getPlugins().keys());
            const filtered = plugins.filter(name => name.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
            await interaction.respond(filtered.map(name => ({ name, value: name })));
        } catch (e) {
            await interaction.respond([]);
        }
    },

    /**
     * Executes the `/metrics` subcommand.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'general') {
            const report = metricsService.getTelemetryReport(interaction.client);

            const embed = new EmbedBuilder()
                .setTitle('📊 System Observability Metrics')
                .setDescription('Metrik utilisasi sistem, latensi gateway, database, dan hit ratio cache.')
                .setColor(COLORS.DEFAULT)
                .addFields(
                    { name: '🖥️ System Utilization', value: `• CPU Usage: \`${report.system.cpuPercent}%\`\n• Uptime: \`${report.system.uptimeSeconds}s\`\n• RAM heapUsed: \`${report.system.memoryUsageMB.heapUsed} MB\` / \`${report.system.memoryUsageMB.heapTotal} MB\` (RSS: \`${report.system.memoryUsageMB.rss} MB\`)`, inline: false },
                    { name: '🔌 Gateway Latency', value: `• WebSocket Ping: \`${report.system.gatewayPingMs} ms\``, inline: true },
                    { name: '🗄️ Database Stats', value: `• Mongoose Queries: \`${report.database.mongooseQueries}\``, inline: true },
                    { name: '💾 Cache Hit Ratio', value: `• Ratio: \`${report.cache.hitRatioPercent}%\` (Hits: \`${report.cache.hits}\` | Misses: \`${report.cache.misses}\`)`, inline: false },
                    { name: '⏱️ Background Jobs', value: `• Active Cron Tasks: \`${report.scheduler.activeCronTasks}\`\n• Job Executions: \`${report.scheduler.totalRuns}\` (Success: \`${report.scheduler.successfulRuns}\` | Failed: \`${report.scheduler.failedRuns}\`)`, inline: false }
                )
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('metrics:export_json')
                    .setLabel('Export JSON Telemetry')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📥')
            );

            return interaction.editReply({ embeds: [embed], components: [row] });
        }

        if (subcommand === 'plugin') {
            const pluginName = interaction.options.getString('plugin_name');
            const report = metricsService.getTelemetryReport(interaction.client);

            const pError = report.pluginErrors.find(p => p.pluginName === pluginName);
            const totalErrors = pError ? pError.totalErrors : 0;
            const lastError = pError && pError.lastError ? pError.lastError.message : 'None';

            const embed = new EmbedBuilder()
                .setTitle(`🔌 Telemetry: ${pluginName}`)
                .setDescription(`Laporan performa dan status plugin \`${pluginName}\`.`)
                .setColor(COLORS.INFO)
                .addFields(
                    { name: '🔴 Execution Errors', value: `• Total: \`${totalErrors}\` kali\n• Terakhir: *${lastError}*`, inline: false }
                )
                .setTimestamp();

            // Find command metrics relating to this plugin
            const pluginMeta = pluginManager.getPlugins().get(pluginName);
            if (pluginMeta) {
                const commands = pluginManager.loadedCommands.get(pluginName) || [];
                if (commands.length > 0) {
                    const cmdLines = commands.map(cmd => {
                        const stats = report.commands.find(c => c.name === cmd);
                        const invocations = stats ? stats.invocations : 0;
                        const latency = stats ? `${stats.avgLatencyMs}ms` : '0ms';
                        return `• \`/${cmd}\`: Invocations: \`${invocations}\` | Avg. Latency: \`${latency}\``;
                    });
                    embed.addFields({ name: '💬 Command Performances', value: cmdLines.join('\n') });
                } else {
                    embed.addFields({ name: '💬 Command Performances', value: '*Plugin tidak memuat slash command.*' });
                }
            } else {
                return interaction.editReply(`❌ Plugin \`${pluginName}\` tidak terdaftar.`);
            }

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
