const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS } = require('../utils/constants');

class ConfigEmbedBuilder {
    /**
     * Resolves a nested property path from a source object.
     * @private
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((acc, part) => {
            if (acc && acc[part] !== undefined) return acc[part];
            return null;
        }, obj);
    }

    /**
     * Constructs the main config dashboard embed payload.
     * @param {Guild} guild Discord Guild object
     * @param {Document} config MongoDB GuildConfig document
     * @returns {EmbedBuilder}
     */
    buildDashboard(guild, config) {
        const formatChannel = (id) => id ? `<#${id}>` : '`🔴 Not Set`';
        const formatRole = (id) => id ? `<@&${id}>` : '`🔴 Not Set`';
        const formatBoolean = (val) => val ? '🟢 Enabled' : '🔴 Disabled';

        return new EmbedBuilder()
            .setTitle('🛠️ Server Configuration System')
            .setDescription('Silakan klik salah satu tombol di bawah untuk mengonfigurasi kategori tersebut. Semua perubahan langsung tersimpan.')
            .setColor(COLORS.DEFAULT)
            .addFields(
                {
                    name: `${EMOJIS.SETTINGS} General & Channels`,
                    value: `• Language: \`${config.general.language.toUpperCase()}\`\n• Prefix: \`${config.general.prefix}\`\n• Welcome: ${formatChannel(config.channels.welcome)}\n• Goodbye: ${formatChannel(config.channels.goodbye)}\n• Logs: ${formatChannel(config.channels.logs)}`,
                    inline: true
                },
                {
                    name: `${EMOJIS.ROLES} Roles`,
                    value: `• Admin: ${formatRole(config.roles.admin)}\n• Mod: ${formatRole(config.roles.moderator)}\n• Staff: ${formatRole(config.roles.staff)}\n• Member: ${formatRole(config.roles.member)}`,
                    inline: true
                },
                {
                    name: '🎮 Systems Status',
                    value: `• Welcome System: ${formatBoolean(config.welcome.enabled)}\n• Logging System: ${formatBoolean(config.logs.enabled)}\n• Moderation: ${formatBoolean(config.moderation.enabled)}\n• Economy: ${formatBoolean(config.economy.enabled)}\n• OwO Assistant: ${formatBoolean(config.owo.enabled)}\n• Leveling: ${formatBoolean(config.level.enabled)}`,
                    inline: false
                }
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();
    }

    /**
     * Constructs category-specific configuration embed payload.
     * @param {Guild} guild Discord Guild object
     * @param {Document} config MongoDB GuildConfig document
     * @param {string} categoryKey Category ID key
     * @param {object} categoryDef Category metadata definition
     * @returns {EmbedBuilder}
     */
    buildCategoryPage(guild, config, categoryKey, categoryDef) {
        const embed = new EmbedBuilder()
            .setTitle(`${categoryDef.emoji} Config | ${categoryDef.title}`)
            .setDescription(categoryDef.description)
            .setColor(COLORS.INFO)
            .setFooter({ text: `${guild.name} • Perubahan instan`, iconURL: guild.iconURL() })
            .setTimestamp();

        // Loop and print each field
        for (const [fieldKey, fieldDef] of Object.entries(categoryDef.fields)) {
            const rawVal = this.getNestedValue(config, fieldDef.path);
            let displayVal = '`🔴 Not Set`';

            if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
                if (fieldDef.type === 'channel') {
                    displayVal = `<#${rawVal}>`;
                } else if (fieldDef.type === 'role') {
                    displayVal = `<@&${rawVal}>`;
                } else if (fieldDef.type === 'boolean') {
                    displayVal = rawVal ? '🟢 Enabled' : '🔴 Disabled';
                } else if (fieldDef.type === 'select') {
                    const choice = fieldDef.choices.find(c => c.value === rawVal);
                    displayVal = choice ? `${choice.emoji || ''} ${choice.label}` : `\`${rawVal}\``;
                } else {
                    displayVal = `\`${rawVal}\``;
                }
            }

            embed.addFields({
                name: fieldDef.name,
                value: `• Value: ${displayVal}\n• Deskripsi: *${fieldDef.description}*`,
                inline: false
            });
        }

        return embed;
    }
}

module.exports = new ConfigEmbedBuilder();
