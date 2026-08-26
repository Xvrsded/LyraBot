const fs = require('fs');

const guildMemberAdd = \const { Events, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        try {
            const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
            if (welcomeChannelId) {
                const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
                if (welcomeChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🎉 Selamat Datang!')
                        .setDescription('Halo <@' + member.id + '>, selamat datang di **' + member.guild.name + '**!\\n\\nSilakan baca peraturan server terlebih dahulu di channel verification dan klik tombol **Verify** untuk mendapatkan akses penuh ke server ini.')
                        .setColor('#3498db')
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();
                    
                    await welcomeChannel.send({ content: '<@' + member.id + '>', embeds: [embed] }).catch(() => {});
                }
            }

            const unverifiedRoleId = process.env.UNVERIFIED_ROLE_ID;
            if (unverifiedRoleId) {
                await member.roles.add(unverifiedRoleId).catch(err => {
                    logger.error('[GuildMemberAdd] Failed to add unverified role:', err);
                });
            }
        } catch (error) {
            logger.error('[GuildMemberAdd] Error handling new member:', error);
        }
    }
};\;
fs.writeFileSync('src/events/guildMemberAdd.js', guildMemberAdd);

const presenceUpdate = \const { Events, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const activeStreamers = new Set();

module.exports = {
    name: Events.PresenceUpdate,
    async execute(oldPresence, newPresence, client) {
        try {
            if (!newPresence || !newPresence.member) return;
            const member = newPresence.member;
            const streamerRoleId = process.env.STREAMER_ROLE_ID;
            const notificationChannelId = process.env.STREAM_NOTIFICATION_CHANNEL_ID;

            if (!streamerRoleId || !notificationChannelId) return;
            if (!member.roles.cache.has(streamerRoleId)) return;

            const isNowStreaming = newPresence.activities.some(activity => activity.type === 1);
            const wasStreaming = oldPresence ? oldPresence.activities.some(activity => activity.type === 1) : false;

            if (isNowStreaming && !activeStreamers.has(member.id)) {
                activeStreamers.add(member.id);
                const streamingActivity = newPresence.activities.find(activity => activity.type === 1);
                
                const channel = await client.channels.fetch(notificationChannelId).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔴 LIVE NOW!')
                        .setDescription('**' + member.user.tag + '** sedang live!')
                        .addFields(
                            { name: '🎮 Game', value: streamingActivity.state || streamingActivity.details || 'Unknown Game', inline: true }
                        )
                        .setColor('#9146FF')
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();

                    if (streamingActivity.url) {
                        embed.addFields({ name: '🔗 Link', value: '[Watch Stream](' + streamingActivity.url + ')', inline: false });
                    }

                    await channel.send({ content: '<@&' + streamerRoleId + '> <@' + member.id + '> sedang live!', embeds: [embed] }).catch(() => {});
                }
            } else if (!isNowStreaming && activeStreamers.has(member.id)) {
                activeStreamers.delete(member.id);
            }
        } catch (error) {
            logger.error('[PresenceUpdate] Error:', error);
        }
    }
};\;
fs.writeFileSync('src/events/presenceUpdate.js', presenceUpdate);

const guildScheduledEventUpdate = \const { Events, EmbedBuilder, GuildScheduledEventStatus } = require('discord.js');
const logger = require('../utils/logger');
const notifiedEvents = new Set();

module.exports = {
    name: Events.GuildScheduledEventUpdate,
    async execute(oldEvent, newEvent, client) {
        try {
            const eventChannelId = process.env.EVENT_NOTIFICATION_CHANNEL_ID;
            if (!eventChannelId) return;

            const isNowActive = newEvent.status === GuildScheduledEventStatus.Active;
            const wasActive = oldEvent ? oldEvent.status === GuildScheduledEventStatus.Active : false;

            if (isNowActive && !wasActive && !notifiedEvents.has(newEvent.id)) {
                notifiedEvents.add(newEvent.id);
                const channel = await client.channels.fetch(eventChannelId).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🎉 SERVER EVENT IS LIVE!')
                        .setDescription('Event **' + newEvent.name + '** sudah dimulai!\\n\\nJangan sampai ketinggalan!')
                        .setColor('#F1C40F')
                        .setTimestamp();

                    if (newEvent.description) embed.addFields({ name: '📝 Deskripsi', value: newEvent.description });
                    const location = newEvent.entityMetadata?.location || (newEvent.channelId ? '<#' + newEvent.channelId + '>' : 'Unknown Location');
                    embed.addFields({ name: '📍 Location', value: location });

                    if (newEvent.url) embed.addFields({ name: '🔗 Join Event', value: '[Klik di sini](' + newEvent.url + ')' });
                    if (newEvent.coverImageURL()) embed.setImage(newEvent.coverImageURL({ size: 512 }));

                    await channel.send({ content: '@everyone Event **' + newEvent.name + '** dimulai!', embeds: [embed] }).catch(() => {});
                }
            } else if (newEvent.status === GuildScheduledEventStatus.Completed || newEvent.status === GuildScheduledEventStatus.Canceled) {
                notifiedEvents.delete(newEvent.id);
            }
        } catch (error) {
            logger.error('[GuildScheduledEventUpdate] Error:', error);
        }
    }
};\;
fs.writeFileSync('src/events/guildScheduledEventUpdate.js', guildScheduledEventUpdate);

const warn = \const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ModerationCase = require('../../models/ModerationCase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Memberikan warning kepada member.')
        .addUserOption(option => option.setName('user').setDescription('Target member').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Alasan warning').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        if (targetUser.bot) return interaction.reply({ content: '❌ Anda tidak dapat memberi warning kepada bot.', ephemeral: true });
        if (targetUser.id === interaction.user.id) return interaction.reply({ content: '❌ Anda tidak dapat memberi warning kepada diri sendiri.', ephemeral: true });

        try {
            await interaction.deferReply();
            const lastCase = await ModerationCase.findOne({ guildId: interaction.guild.id }).sort({ caseNumber: -1 });
            const nextCaseNum = lastCase ? lastCase.caseNumber + 1 : 1;

            await ModerationCase.create({
                guildId: interaction.guild.id,
                caseNumber: nextCaseNum,
                action: 'WARN',
                targetId: targetUser.id,
                targetTag: targetUser.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason: reason,
                correlationId: 'WARN-' + interaction.guild.id + '-' + Date.now()
            });

            const totalWarnings = await ModerationCase.countDocuments({ guildId: interaction.guild.id, targetId: targetUser.id, action: 'WARN' });

            const modChannelId = process.env.MODERATION_NOTIFICATION_CHANNEL_ID;
            if (modChannelId) {
                const modChannel = await interaction.client.channels.fetch(modChannelId).catch(() => null);
                if (modChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('⚠️ MEMBER WARNED')
                        .addFields(
                            { name: '👤 User', value: '<@' + targetUser.id + '>', inline: true },
                            { name: '👮 Moderator', value: '<@' + interaction.user.id + '>', inline: true },
                            { name: '⚠️ Action', value: 'Warning', inline: true },
                            { name: '📝 Reason', value: reason, inline: false },
                            { name: '🔢 Total Warnings', value: totalWarnings.toString(), inline: false }
                        )
                        .setColor('#F39C12')
                        .setTimestamp();
                    await modChannel.send({ embeds: [embed] }).catch(() => {});
                }
            }
            return interaction.editReply({ content: '✅ Berhasil memberikan warning kepada <@' + targetUser.id + '>.' });
        } catch (error) {
            console.error('[Warn Command] Error:', error);
            return interaction.editReply({ content: '❌ Terjadi kesalahan saat memproses warning.' });
        }
    }
};\;
fs.writeFileSync('src/commands/moderation/warn.js', warn);

const warnings = \const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ModerationCase = require('../../models/ModerationCase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Melihat riwayat warning member.')
        .addUserOption(option => option.setName('user').setDescription('Target member').setRequired(true)),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        try {
            await interaction.deferReply();
            const warnings = await ModerationCase.find({ guildId: interaction.guild.id, targetId: targetUser.id, action: 'WARN' }).sort({ timestamp: -1 });

            if (warnings.length === 0) return interaction.editReply({ content: '✅ <@' + targetUser.id + '> tidak memiliki warning.' });

            const embed = new EmbedBuilder()
                .setTitle('Riwayat Warning: ' + targetUser.tag)
                .setDescription('Total Warning: **' + warnings.length + '**')
                .setColor('#F39C12')
                .setTimestamp();

            warnings.forEach((warn, index) => {
                const date = '<t:' + Math.floor(warn.timestamp.getTime() / 1000) + ':d>';
                embed.addFields({
                    name: 'Warning #' + (warnings.length - index),
                    value: '**Moderator:** <@' + warn.moderatorId + '>\\n**Alasan:** ' + warn.reason + '\\n**Tanggal:** ' + date
                });
            });

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[Warnings Command] Error:', error);
            return interaction.editReply({ content: '❌ Terjadi kesalahan saat memuat warning.' });
        }
    }
};\;
fs.writeFileSync('src/commands/moderation/warnings.js', warnings);

const clearwarnings = \const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ModerationCase = require('../../models/ModerationCase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('Menghapus semua warning dari member.')
        .addUserOption(option => option.setName('user').setDescription('Target member').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        try {
            await interaction.deferReply();
            const result = await ModerationCase.deleteMany({ guildId: interaction.guild.id, targetId: targetUser.id, action: 'WARN' });

            if (result.deletedCount === 0) return interaction.editReply({ content: 'ℹ️ <@' + targetUser.id + '> tidak memiliki warning untuk dihapus.' });
            return interaction.editReply({ content: '🗑️ Berhasil menghapus **' + result.deletedCount + '** warning dari <@' + targetUser.id + '>.' });
        } catch (error) {
            console.error('[ClearWarnings Command] Error:', error);
            return interaction.editReply({ content: '❌ Terjadi kesalahan saat menghapus warning.' });
        }
    }
};\;
fs.writeFileSync('src/commands/moderation/clearwarnings.js', clearwarnings);

const guildMemberUpdate = \const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const logger = require('../utils/logger');
const processedTimeouts = new Set();

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        try {
            const modChannelId = process.env.MODERATION_NOTIFICATION_CHANNEL_ID;
            if (!modChannelId) return;

            if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
                const timeoutUntil = newMember.communicationDisabledUntil;
                const cacheKey = 'TIMEOUT-' + newMember.id + '-' + timeoutUntil.getTime();
                
                if (processedTimeouts.has(cacheKey)) return;
                processedTimeouts.add(cacheKey);
                setTimeout(() => processedTimeouts.delete(cacheKey), 60000);

                const auditLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate }).catch(() => null);
                let moderator = 'Unknown Moderator';
                let reason = 'No reason provided';

                if (auditLogs) {
                    const timeoutLog = auditLogs.entries.first();
                    if (timeoutLog && timeoutLog.target.id === newMember.id && timeoutLog.createdTimestamp > Date.now() - 10000) {
                        if (timeoutLog.changes.some(change => change.key === 'communication_disabled_until')) {
                            moderator = '<@' + timeoutLog.executor.id + '>';
                            reason = timeoutLog.reason || 'No reason provided';
                        }
                    }
                }

                const durationMs = timeoutUntil.getTime() - Date.now();
                const durationMinutes = Math.round(durationMs / 60000);

                const channel = await client.channels.fetch(modChannelId).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔨 MEMBER TIMEOUT')
                        .addFields(
                            { name: '👤 User', value: '<@' + newMember.id + '>', inline: true },
                            { name: '👮 Moderator', value: moderator, inline: true },
                            { name: '🔨 Action', value: 'Timeout', inline: true },
                            { name: '⏱️ Duration', value: durationMinutes + ' minutes', inline: true },
                            { name: '📝 Reason', value: reason, inline: false }
                        )
                        .setColor('#E67E22')
                        .setTimestamp();
                    await channel.send({ embeds: [embed] }).catch(() => {});
                }
            }
        } catch (error) {
            logger.error('[GuildMemberUpdate] Error processing timeout notification:', error);
        }
    }
};\;
fs.writeFileSync('src/events/guildMemberUpdate.js', guildMemberUpdate);

const guildBanAdd = \const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const logger = require('../utils/logger');
const processedBans = new Set();

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban, client) {
        try {
            const modChannelId = process.env.MODERATION_NOTIFICATION_CHANNEL_ID;
            if (!modChannelId) return;

            const cacheKey = 'BAN-' + ban.user.id;
            if (processedBans.has(cacheKey)) return;
            processedBans.add(cacheKey);
            setTimeout(() => processedBans.delete(cacheKey), 60000);

            const auditLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
            let moderator = 'Unknown Moderator';
            let reason = ban.reason || 'No reason provided';

            if (auditLogs) {
                const banLog = auditLogs.entries.first();
                if (banLog && banLog.target.id === ban.user.id && banLog.createdTimestamp > Date.now() - 10000) {
                    moderator = '<@' + banLog.executor.id + '>';
                    if (banLog.reason) reason = banLog.reason;
                }
            }

            const channel = await client.channels.fetch(modChannelId).catch(() => null);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('🔨 MEMBER BANNED')
                    .addFields(
                        { name: '👤 User', value: '<@' + ban.user.id + '>', inline: true },
                        { name: '👮 Moderator', value: moderator, inline: true },
                        { name: '🔨 Action', value: 'Ban', inline: true },
                        { name: '📝 Reason', value: reason, inline: false }
                    )
                    .setColor('#E74C3C')
                    .setTimestamp();
                await channel.send({ embeds: [embed] }).catch(() => {});
            }
        } catch (error) {
            logger.error('[GuildBanAdd] Error processing ban notification:', error);
        }
    }
};\;
fs.writeFileSync('src/events/guildBanAdd.js', guildBanAdd);
