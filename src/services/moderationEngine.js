const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ModerationCase = require('../models/ModerationCase');
const eventBus = require('./eventBus');
const metricsService = require('./metricsService');
const configService = require('./configService');
const logger = require('../utils/logger');
const { COLORS } = require('../utils/constants');

class ModerationEngine {
    /**
     * Executes a standardized moderation pipeline.
     * @param {Guild} guild Discord Guild object
     * @param {object} params Parameter payload (action, targetId, moderator, reason, durationMs)
     * @returns {Promise<{ success: boolean, caseNumber: number, summary: string }>}
     */
    async executeAction(guild, params) {
        const { action, targetId, moderator, reason = 'Tidak ada alasan.', durationMs = null } = params;
        const correlationId = `mod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        logger.info(`[ModerationEngine] Initiating ${action} on ${targetId} by ${moderator.user.tag}`);

        const startTime = Date.now();
        let targetTag = 'Unknown#0000';

        try {
            // 1. Permission & Target Validations
            const targetMember = await guild.members.fetch(targetId).catch(() => null);
            if (targetMember) {
                targetTag = targetMember.user.tag;
            } else {
                // If banning/unbanning user not in guild, fetch user tag
                const user = await guild.client.users.fetch(targetId).catch(() => null);
                if (user) targetTag = user.tag;
            }

            // Perform checks
            this.validateHierarchy(guild, moderator, targetMember, action);

            // 2. Execution of action
            await this.performDiscordAction(guild, targetMember, targetId, action, reason, durationMs);

            // 3. Database Persistence (Case creation with auto-increment caseNumber per guild)
            const lastCase = await ModerationCase.findOne({ guildId: guild.id }).sort({ caseNumber: -1 });
            const caseNumber = lastCase ? lastCase.caseNumber + 1 : 1;

            const modCase = await ModerationCase.create({
                guildId: guild.id,
                caseNumber,
                action,
                targetId,
                targetTag,
                moderatorId: moderator.id,
                moderatorTag: moderator.user.tag,
                reason,
                correlationId
            });

            // 4. Audit Log message dispatching
            await this.sendAuditLog(guild, modCase, durationMs);

            // 5. Emit EventBus & Metrics
            eventBus.emit('case.created', { caseNumber, action, targetId }, { plugin: 'moderation', guildId: guild.id, userId: targetId });
            eventBus.emit('moderation.executed', { caseNumber, action, targetId, durationMs }, { plugin: 'moderation', guildId: guild.id, userId: targetId });

            const latency = Date.now() - startTime;
            metricsService.recordCommand(`mod_${action.toLowerCase()}`, latency);

            return {
                success: true,
                caseNumber,
                summary: `✅ **Kasus #${caseNumber}**: Berhasil melakukan **${action}** pada **${targetTag}**.`
            };
        } catch (err) {
            logger.error(`[ModerationEngine] ${action} failed:`, err.message);
            eventBus.emit('moderation.failed', { action, targetId, error: err.message }, { plugin: 'moderation', guildId: guild.id, userId: targetId });
            throw err;
        }
    }

    /**
     * Validates moderator hierarchy and permission safety.
     * @private
     */
    validateHierarchy(guild, moderator, targetMember, action) {
        if (!targetMember) return;

        // Prevent mod actions against owner or bot
        if (targetMember.id === guild.ownerId) {
            throw new Error('Anda tidak dapat melakukan tindakan moderasi terhadap Pemilik Server.');
        }
        if (targetMember.id === guild.client.user.id) {
            throw new Error('Anda tidak dapat melakukan tindakan moderasi terhadap bot ini.');
        }

        // Verify Moderator's hierarchy
        const isModAdmin = moderator.permissions.has(PermissionFlagsBits.Administrator);
        if (!isModAdmin && moderator.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
            throw new Error('Tindakan ditolak: Hierarki role Anda lebih rendah atau setara dengan target.');
        }

        // Verify Bot's hierarchy
        const me = guild.members.me;
        if (me.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
            throw new Error('Tindakan ditolak: Hierarki role bot lebih rendah atau setara dengan target.');
        }
    }

    /**
     * Executes the actual Discord API changes.
     * @private
     */
    async performDiscordAction(guild, targetMember, targetId, action, reason, durationMs) {
        const me = guild.members.me;

        switch (action) {
            case 'WARN':
                // Warning is database-only, no API punishment
                break;
            case 'KICK':
                if (!targetMember) throw new Error('Target tidak berada di server.');
                if (!targetMember.kickable) throw new Error('Bot tidak memiliki izin untuk menendang target.');
                await targetMember.kick(reason);
                break;
            case 'BAN':
                if (!me.permissions.has(PermissionFlagsBits.BanMembers)) {
                    throw new Error('Bot kekurangan izin BAN_MEMBERS.');
                }
                await guild.members.ban(targetId, { reason, deleteMessageSeconds: 0 });
                break;
            case 'SOFTBAN':
                if (!me.permissions.has(PermissionFlagsBits.BanMembers)) {
                    throw new Error('Bot kekurangan izin BAN_MEMBERS.');
                }
                // Ban (deleting 7 days message logs) and instantly unban
                await guild.members.ban(targetId, { reason: `Softban: ${reason}`, deleteMessageSeconds: 7 * 24 * 60 * 60 });
                await guild.members.unban(targetId, 'Softban complete: instant unban');
                break;
            case 'TIMEOUT':
                if (!targetMember) throw new Error('Target tidak berada di server.');
                if (!targetMember.moderatable) throw new Error('Bot tidak dapat membisukan target.');
                if (!durationMs) throw new Error('Durasi timeout wajib disertakan.');
                await targetMember.timeout(durationMs, reason);
                break;
            case 'UNBAN':
                if (!me.permissions.has(PermissionFlagsBits.BanMembers)) {
                    throw new Error('Bot kekurangan izin BAN_MEMBERS.');
                }
                await guild.members.unban(targetId, reason);
                break;
            default:
                throw new Error(`Aksi moderasi "${action}" belum didukung.`);
        }
    }

    /**
     * Sends formatted audit logs to the configured channel.
     * @private
     */
    async sendAuditLog(guild, modCase, durationMs) {
        try {
            const config = await configService.getConfig(guild.id);
            const logChannelId = config.channels?.logs;
            if (!logChannelId) return;

            const logChannel = guild.channels.cache.get(logChannelId);
            if (!logChannel) return;

            const durationText = durationMs ? `\n• **Durasi**: \`${Math.round(durationMs / 1000 / 60)} menit\`` : '';

            const embed = new EmbedBuilder()
                .setTitle(`🚨 Moderasi Kasus #${modCase.caseNumber}`)
                .setDescription(`Tindakan **${modCase.action}** telah dilakukan.`)
                .setColor(COLORS.DANGER)
                .addFields(
                    { name: '👤 Target User', value: `<@${modCase.targetId}> (${modCase.targetTag})`, inline: true },
                    { name: '👨💼 Moderator', value: `<@${modCase.moderatorId}> (${modCase.moderatorTag})`, inline: true },
                    { name: '📝 Alasan', value: modCase.reason, inline: false }
                )
                .setFooter({ text: `ID Korelasi: ${modCase.correlationId}` })
                .setTimestamp();

            if (durationText) {
                embed.addFields({ name: '⏱️ Detail Waktu', value: durationText });
            }

            await logChannel.send({ embeds: [embed] });
        } catch (err) {
            logger.error('[ModerationEngine] Failed to dispatch audit log:', err.message);
        }
    }
}

module.exports = new ModerationEngine();
