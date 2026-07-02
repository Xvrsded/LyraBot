const { Events, EmbedBuilder } = require('discord.js');
const WelcomeConfig = require('../models/WelcomeConfig');
const LeaveConfig = require('../models/LeaveConfig');
const onboardingManager = require('../services/onboardingManager');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberRemove,
    /**
     * Executes when a member leaves the guild. Saves previous roles and sends goodbye message.
     * @param {GuildMember} member Discord GuildMember
     */
    async execute(member) {
        try {
            // 1. Trigger role backup and leave analytics
            await onboardingManager.handleMemberLeave(member);

            // 2. Fetch target channel for goodbye notification
            let targetChannel = null;

            const leaveConfig = await LeaveConfig.findOne({ guildId: member.guild.id });
            if (leaveConfig && leaveConfig.channelId) {
                targetChannel = member.guild.channels.cache.get(leaveConfig.channelId);
            }

            if (!targetChannel) {
                targetChannel = member.guild.channels.cache.find(c => 
                    c.name.toLowerCase().includes('goodbye') || 
                    c.name.toLowerCase().includes('leave') ||
                    c.name.toLowerCase().includes('keluar') ||
                    c.name.toLowerCase().includes('out')
                );
            }

            if (!targetChannel) {
                const welcomeConfig = await WelcomeConfig.findOne({ guildId: member.guild.id });
                if (welcomeConfig && welcomeConfig.channelId) {
                    targetChannel = member.guild.channels.cache.get(welcomeConfig.channelId);
                }
            }

            if (targetChannel) {
                let messageContent = `🍂 **Yahhh, ada yang pergi dari {server} nih...** 🍂\n\nSelamat jalan, **{username}**! 👋 Makasih banyak ya udah pernah mampir dan ikut ngeramein komunitas kita.\n\nHati-hati di jalan, semoga sukses terus di luaran sana! See ya! ✨`;
                
                messageContent = messageContent
                    .replace(/{user}/g, `<@${member.id}>`)
                    .replace(/{username}/g, member.user.username)
                    .replace(/{server}/g, member.guild.name)
                    .replace(/{membercount}/g, member.guild.memberCount);

                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setDescription(messageContent)
                    .setTimestamp();

                const payload = { content: `**${member.user.username}** telah meninggalkan server.`, embeds: [embed] };

                await targetChannel.send(payload).catch(err => {
                    logger.error(`[Events: GuildMemberRemove] Failed to send goodbye to channel ${targetChannel.id}:`, err.message);
                });
            }

        } catch (error) {
            logger.error('[Events: GuildMemberRemove] Event error:', error);
        }
    },
};
