const { EmbedBuilder } = require('discord.js');
const AuditEntry = require('../models/AuditEntry');
const auditChannelManager = require('./auditChannelManager');
const logger = require('../utils/logger');
const { COLORS } = require('../utils/constants');

class AuditService {
    constructor() {
        this.client = null;
        this.defaultRetentionDays = 30;
    }

    /**
     * Initializes the AuditService with the Discord client.
     * @param {Client} client Discord Client object
     */
    init(client) {
        this.client = client;
        logger.info('[AuditService] Centralized Audit framework initialized.');

        // Schedule daily cleanup job using our new Scheduler framework!
        const jobManager = require('./jobManager');
        const scheduler = require('./scheduler');

        jobManager.registerJob('audit-cleanup-job', async () => {
            logger.info('[AuditService] Running daily database log retention cleanup...');
            const deleted = await this.cleanOldLogs(this.defaultRetentionDays);
            logger.info(`[AuditService] Retention cleanup complete. Deleted ${deleted} old entries.`);
        });

        // Run once every 24 hours (86400000 ms)
        jobManager.scheduleInterval('audit-cleanup-job', 24 * 60 * 60 * 1000)
            .catch(err => logger.error('[AuditService] Failed to schedule retention clean:', err.message));
    }

    /**
     * Logs an INFO severity audit record.
     * @param {string} plugin Origin plugin name
     * @param {string} action Action key (e.g. 'CONFIG_UPDATE')
     * @param {object} params Parameter payload
     */
    async info(plugin, action, params) {
        return this.log('Info', plugin, action, params);
    }

    /**
     * Logs a WARNING severity audit record.
     */
    async warn(plugin, action, params) {
        return this.log('Warning', plugin, action, params);
    }

    /**
     * Logs an ERROR severity audit record.
     */
    async error(plugin, action, params) {
        return this.log('Error', plugin, action, params);
    }

    /**
     * Logs a SECURITY severity audit record.
     */
    async security(plugin, action, params) {
        return this.log('Security', plugin, action, params);
    }

    /**
     * Core logging controller persisting to DB and dispatching to Discord.
     * @private
     */
    async log(severity, plugin, action, params) {
        const auditId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const correlationId = params.correlationId || `corr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        try {
            const entry = await AuditEntry.create({
                auditId,
                correlationId,
                plugin,
                guildId: params.guildId,
                userId: params.userId,
                targetId: params.targetId,
                action,
                severity,
                before: params.before || null,
                after: params.after || null,
                metadata: params.metadata || {},
                duration: params.duration || 0,
                timestamp: new Date()
            });

            logger.info(`[AuditService] Saved entry: "${action}" [Severity: ${severity}] Correlation: ${correlationId}`);

            // Dispatch to Discord logs channel asynchronously
            if (this.client && params.guildId) {
                this.dispatchDiscordLog(entry).catch(err => {
                    logger.error('[AuditService] Discord log dispatch failed:', err.message);
                });
            }

            return entry;
        } catch (err) {
            logger.error('[AuditService] Failed to save audit log to DB:', err.message);
        }
    }

    /**
     * Routes and posts the audit embed to the target Discord channel.
     * @private
     */
    async dispatchDiscordLog(entry) {
        const guild = this.client.guilds.cache.get(entry.guildId);
        if (!guild) return;

        const channelId = await auditChannelManager.resolveChannelId(guild, entry);
        if (!channelId) return;

        const channel = guild.channels.cache.get(channelId);
        if (!channel) return;

        // Choose color based on severity
        let color = COLORS.DEFAULT;
        if (entry.severity === 'Info') color = COLORS.SUCCESS;
        if (entry.severity === 'Warning') color = COLORS.WARNING;
        if (entry.severity === 'Error' || entry.severity === 'Critical') color = COLORS.DANGER;
        if (entry.severity === 'Security') color = '#9b59b6'; // Purple

        const embed = new EmbedBuilder()
            .setTitle(`📂 Audit Log: ${entry.action}`)
            .setDescription(`Aktivitas tercatat oleh plugin **${entry.plugin}**.`)
            .setColor(color)
            .addFields(
                { name: '🛑 Severity', value: `\`${entry.severity}\``, inline: true },
                { name: '🆔 Correlation ID', value: `\`${entry.correlationId}\``, inline: true },
                { name: '🕒 Waktu', value: `<t:${Math.round(entry.timestamp.getTime() / 1000)}:R>`, inline: true }
            )
            .setTimestamp();

        if (entry.userId) embed.addFields({ name: '👨💼 Pelaku (User)', value: `<@${entry.userId}>`, inline: true });
        if (entry.targetId) embed.addFields({ name: '🎯 Target', value: `<@${entry.targetId}>`, inline: true });

        // Add metadata snippets if available
        if (entry.metadata && Object.keys(entry.metadata).length > 0) {
            const metaStr = JSON.stringify(entry.metadata).substring(0, 1024);
            embed.addFields({ name: '📦 Metadata', value: `\`\`\`json\n${metaStr}\n\`\`\`` });
        }

        await channel.send({ embeds: [embed] }).catch(err => {
            logger.warn(`[AuditService] Failed to send message to log channel ${channelId}:`, err.message);
        });
    }

    /**
     * Cleans database entries exceeding retention constraints.
     * @param {number} retentionDays Log age limit in days
     * @returns {Promise<number>} Count of deleted records
     */
    async cleanOldLogs(retentionDays) {
        const threshold = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
        const result = await AuditEntry.deleteMany({ timestamp: { $lte: threshold } });
        return result.deletedCount;
    }
}

module.exports = new AuditService();
