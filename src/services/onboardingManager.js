const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const MemberIdentity = require('../models/MemberIdentity');
const OnboardingAnalytics = require('../models/OnboardingAnalytics');
const welcomeRenderer = require('./welcomeRenderer');
const identityService = require('./identityService');
const eventBus = require('./eventBus');
const configService = require('./configService');
const logger = require('../utils/logger');
const { COLORS } = require('../utils/constants');

class OnboardingManager {
    /**
     * Entry point triggered when a member joins the guild.
     * @param {GuildMember} member Discord GuildMember object
     */
    async handleMemberJoin(member) {
        logger.info(`[OnboardingManager] Member joined: "${member.user.username}" (${member.id}) in guild "${member.guild.name}"`);
        const guildId = member.guild.id;

        // 1. Record Analytics Join
        await this.trackJoin(guildId);

        // 2. Load Configuration
        const config = await configService.getConfig(guildId);
        
        // 3. Create Member Identity Record
        const identity = await MemberIdentity.findOneAndUpdate(
            { guildId, userId: member.id },
            {
                username: member.user.username,
                status: 'pending',
                joinedAt: new Date(),
                verificationAttempts: 0
            },
            { upsert: true, new: true }
        );

        // Emit onboarding started event
        eventBus.emit('onboarding.started', { userId: member.id, guildId }, { plugin: 'onboarding', guildId, userId: member.id });

        // 4. Send Welcome Message
        const welcomeEnabled = config.welcome?.enabled;
        const welcomeChannelId = config.channels?.welcome;
        let welcomeChannel = null;
        if (welcomeChannelId) {
            welcomeChannel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
        }

        if (welcomeEnabled && welcomeChannel) {
            const welcomePayload = welcomeRenderer.renderWelcomePayload(member, config.welcome);
            await welcomeChannel.send(welcomePayload).catch(err => {
                logger.error('[OnboardingManager] Failed to send welcome message:', err.message);
            });
        }

        // 5. Verification routing based on Verification Mode
        // Modes: None, Button, Captcha
        const mode = config.welcome?.verificationMode || 'None';
        logger.info(`[OnboardingManager] Verification mode for guild ${guildId}: ${mode}`);

        if (mode === 'None') {
            // Auto complete onboarding
            await this.completeOnboarding(member, identity, config);
        } else if (mode === 'Button') {
            // Send verify button in welcome channel (or general verify channel)
            const verifyChannelId = config.channels?.verify || welcomeChannelId;
            let verifyChannel = null;
            if (verifyChannelId) {
                verifyChannel = await member.guild.channels.fetch(verifyChannelId).catch(() => null);
            }
            if (verifyChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🔒 Verifikasi Anggota Baru')
                    .setDescription(`Halo ${member}, klik tombol di bawah untuk memverifikasi diri Anda dan mendapatkan akses ke seluruh server.`)
                    .setColor(COLORS.INFO);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`onboarding:verify_btn:${member.id}`)
                        .setLabel('Verifikasi')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅')
                );

                await verifyChannel.send({ content: `<@${member.id}>`, embeds: [embed], components: [row] }).catch(err => {
                    logger.error('[OnboardingManager] Failed to send verification prompt:', err.message);
                });
                
                identity.status = 'verifying';
                await identity.save();
            } else {
                // Fallback if no channel found
                await this.completeOnboarding(member, identity, config);
            }
        } else if (mode === 'Captcha') {
            const verifyChannelId = config.channels?.verify || welcomeChannelId;
            let verifyChannel = null;
            if (verifyChannelId) {
                verifyChannel = await member.guild.channels.fetch(verifyChannelId).catch(() => null);
            }
            if (verifyChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🧩 Captcha Verification Required')
                    .setDescription(`Halo ${member}, klik tombol di bawah untuk menyelesaikan tantangan Captcha teks.`)
                    .setColor(COLORS.WARNING);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`onboarding:captcha_req:${member.id}`)
                        .setLabel('Minta Captcha')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🧩')
                );

                await verifyChannel.send({ content: `<@${member.id}>`, embeds: [embed], components: [row] }).catch(err => {
                    logger.error('[OnboardingManager] Failed to send Captcha prompt:', err.message);
                });

                identity.status = 'verifying';
                await identity.save();
            } else {
                await this.completeOnboarding(member, identity, config);
            }
        }
    }

    /**
     * Entry point triggered when a member leaves the guild.
     */
    async handleMemberLeave(member) {
        logger.info(`[OnboardingManager] Member left: "${member.user.username}" (${member.id})`);
        // 1. Record Analytics Leave
        await this.trackLeave(member.guild.id);

        // 2. Save Roles for Restore
        await identityService.saveMemberRoles(member);
    }

    /**
     * Completes the onboarding workflow: verifies, restores roles, registers analytics, and activates member.
     * @param {GuildMember} member Discord GuildMember
     * @param {Document} identity Mongoose MemberIdentity document
     * @param {object} config Configuration document
     */
    async completeOnboarding(member, identity, config) {
        logger.info(`[OnboardingManager] Completing onboarding for "${member.user.username}" (${member.id})`);
        const guildId = member.guild.id;

        // 1. Update Identity State
        identity.status = 'active';
        identity.verifiedAt = new Date();
        await identity.save();

        const durationMs = Date.now() - identity.joinedAt.getTime();

        // 2. Track Analytics Verification Success
        await this.trackVerificationSuccess(guildId, durationMs);

        // 3. Emit Verification Completed Event
        eventBus.emit('verification.completed', { userId: member.id, guildId, durationMs }, { plugin: 'onboarding', guildId, userId: member.id });

        // 4. Assign Auto Roles
        const autoRoleId = config.welcome?.autoRole;
        if (autoRoleId) {
            const role = member.guild.roles.cache.get(autoRoleId);
            if (role) {
                await member.roles.add(role, 'Identity Framework: Welcome Auto Role').catch(err => {
                    logger.error(`[OnboardingManager] Failed to add autoRole to ${member.id}:`, err.message);
                });
            }
        }
        eventBus.emit('roles.assigned', { userId: member.id, guildId }, { plugin: 'onboarding', guildId, userId: member.id });

        // 5. Restore Previous Roles (if enabled in configurations)
        const restoreEnabled = config.welcome?.restoreRoles;
        if (restoreEnabled) {
            await identityService.restoreMemberRoles(member);
        }

        // 6. Final Activation Alerts
        eventBus.emit('member.activated', { userId: member.id, guildId }, { plugin: 'onboarding', guildId, userId: member.id });
        eventBus.emit('onboarding.completed', { userId: member.id, guildId }, { plugin: 'onboarding', guildId, userId: member.id });
        
        logger.info(`[OnboardingManager] Onboarding workflow fully completed for member: "${member.user.username}"`);
    }

    /**
     * Increments join counts in daily analytics.
     * @private
     */
    async trackJoin(guildId) {
        const today = new Date().toISOString().split('T')[0];
        await OnboardingAnalytics.findOneAndUpdate(
            { guildId, date: today },
            { $inc: { joins: 1 } },
            { upsert: true }
        );
    }

    /**
     * Increments leave counts in daily analytics.
     * @private
     */
    async trackLeave(guildId) {
        const today = new Date().toISOString().split('T')[0];
        await OnboardingAnalytics.findOneAndUpdate(
            { guildId, date: today },
            { $inc: { leaves: 1 } },
            { upsert: true }
        );
    }

    /**
     * Increments verification count and logs duration.
     * @private
     */
    async trackVerificationSuccess(guildId, durationMs) {
        const today = new Date().toISOString().split('T')[0];
        await OnboardingAnalytics.findOneAndUpdate(
            { guildId, date: today },
            { $inc: { verifiedCount: 1, totalVerificationTimeMs: durationMs } },
            { upsert: true }
        );
    }
}

module.exports = new OnboardingManager();
