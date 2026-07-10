const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../utils/constants');

class WelcomeRenderer {
    /**
     * Parses custom variables in welcome strings.
     * @param {string} text Target text template
     * @param {GuildMember} member Discord GuildMember object
     * @returns {string} Fully parsed text
     */
    parseVariables(text, member) {
        if (!text) return '';

        const guild = member.guild;
        const accountAgeMs = Date.now() - member.user.createdTimestamp;
        const accountAgeDays = Math.max(0, Math.floor(accountAgeMs / (1000 * 60 * 60 * 24)));

        return text
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{server}/g, guild.name)
            .replace(/{memberCount}/g, String(guild.memberCount))
            .replace(/{joinDate}/g, new Date().toLocaleDateString('id-ID'))
            .replace(/{accountAge}/g, `${accountAgeDays} hari`);
    }

    /**
     * Renders a fully formatted welcome payload including text, embeds, or attachments.
     * @param {GuildMember} member Discord GuildMember object
     * @param {object} config Welcome configuration object (welcome.enabled, welcome.message, welcome.embed, etc.)
     * @returns {object} Discord Message payload object
     */
    renderWelcomePayload(member, config) {
        const messageText = config.message || 'Selamat datang {user} di server {server}!';
        const parsedText = this.parseVariables(messageText, member);

        // Standard Embed Welcome
        const embed = new EmbedBuilder()
            .setTitle(`👋 Welcome to ${member.guild.name}!`)
            .setDescription(parsedText)
            .setColor(COLORS.SUCCESS)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 Username', value: member.user.username, inline: true },
                { name: '📅 Akun Dibuat', value: `<t:${Math.round(member.user.createdTimestamp / 1000)}:D> (<t:${Math.round(member.user.createdTimestamp / 1000)}:R>)`, inline: true },
                { name: '👥 Member Ke', value: `\`#${member.guild.memberCount}\``, inline: false }
            )
            .setTimestamp();

        if (config.welcomeGif) {
            embed.setImage(config.welcomeGif);
        }

        return {
            content: `<@${member.id}>`,
            embeds: [embed]
        };
    }
}

module.exports = new WelcomeRenderer();
