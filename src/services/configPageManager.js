const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const configDefinitions = require('../utils/configDefinitions');
const configEmbedBuilder = require('./configEmbedBuilder');
const { EMOJIS } = require('../utils/constants');

class ConfigPageManager {
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
     * Generates the main dashboard configuration payload.
     * @param {Guild} guild Discord Guild object
     * @param {Document} config MongoDB GuildConfig document
     * @returns {object} Message payload object
     */
    getDashboardPayload(guild, config) {
        const embed = configEmbedBuilder.buildDashboard(guild, config);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('config_btn_general').setLabel('General').setStyle(ButtonStyle.Primary).setEmoji(EMOJIS.SETTINGS),
            new ButtonBuilder().setCustomId('config_btn_channels').setLabel('Channels').setStyle(ButtonStyle.Primary).setEmoji(EMOJIS.CHANNELS),
            new ButtonBuilder().setCustomId('config_btn_roles').setLabel('Roles').setStyle(ButtonStyle.Primary).setEmoji(EMOJIS.ROLES),
            new ButtonBuilder().setCustomId('config_btn_welcome').setLabel('Welcome').setStyle(ButtonStyle.Primary).setEmoji(EMOJIS.WELCOME),
            new ButtonBuilder().setCustomId('config_btn_logs').setLabel('Logs').setStyle(ButtonStyle.Primary).setEmoji(EMOJIS.LOGS)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('config_btn_moderation').setLabel('Moderation').setStyle(ButtonStyle.Success).setEmoji(EMOJIS.MODERATION),
            new ButtonBuilder().setCustomId('config_btn_owo').setLabel('OwO').setStyle(ButtonStyle.Success).setEmoji(EMOJIS.OWO),
            new ButtonBuilder().setCustomId('config_btn_economy').setLabel('Economy').setStyle(ButtonStyle.Success).setEmoji(EMOJIS.ECONOMY),
            new ButtonBuilder().setCustomId('config_btn_level').setLabel('Level').setStyle(ButtonStyle.Success).setEmoji(EMOJIS.LEVEL),
            new ButtonBuilder().setCustomId('config_btn_quests').setLabel('Quest').setStyle(ButtonStyle.Success).setEmoji(EMOJIS.QUEST)
        );

        return { embeds: [embed], components: [row1, row2] };
    }

    /**
     * Generates the configuration payload for a specific category.
     * @param {Guild} guild Discord Guild object
     * @param {Document} config MongoDB GuildConfig document
     * @param {string} categoryKey Category identifier key
     * @returns {object} Message payload object
     */
    getCategoryPagePayload(guild, config, categoryKey) {
        const categoryDef = configDefinitions[categoryKey];
        if (!categoryDef) {
            throw new Error(`Kategori ${categoryKey} tidak ditemukan.`);
        }

        const embed = configEmbedBuilder.buildCategoryPage(guild, config, categoryKey, categoryDef);

        // Build Select Menu for fields
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`config:select_field:${categoryKey}`)
            .setPlaceholder('Pilih pengaturan untuk mulai mengedit...');

        for (const [fieldKey, fieldDef] of Object.entries(categoryDef.fields)) {
            const rawVal = this.getNestedValue(config, fieldDef.path);
            let desc = fieldDef.description;
            if (desc.length > 50) desc = desc.substring(0, 47) + '...';

            selectMenu.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Edit: ${fieldDef.name}`)
                    .setValue(fieldKey)
                    .setDescription(desc)
                    .setEmoji(categoryDef.emoji)
            );
        }

        const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

        // Navigation buttons
        const rowNav = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('config:dashboard')
                .setLabel('◀️ Kembali ke Menu Utama')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`config:reset:${categoryKey}`)
                .setLabel('🔄 Reset Kategori')
                .setStyle(ButtonStyle.Danger)
        );

        return { embeds: [embed], components: [rowSelect, rowNav] };
    }

    /**
     * Generates the edit selector interface payload (for Channel/Role/Select types).
     * @param {Guild} guild Discord Guild object
     * @param {Document} config MongoDB GuildConfig document
     * @param {string} categoryKey Category identifier key
     * @param {string} fieldKey Field identifier key
     * @returns {object} Message payload object
     */
    getFieldEditPayload(guild, config, categoryKey, fieldKey) {
        const categoryDef = configDefinitions[categoryKey];
        const fieldDef = categoryDef?.fields[fieldKey];
        if (!fieldDef) {
            throw new Error(`Field ${fieldKey} pada kategori ${categoryKey} tidak ditemukan.`);
        }

        const embed = configEmbedBuilder.buildCategoryPage(guild, config, categoryKey, categoryDef);
        embed.setDescription(`👉 **Mengedit Pengaturan:** ${fieldDef.name}\n\n*${fieldDef.description}*`);

        let inputComponent;

        if (fieldDef.type === 'channel') {
            inputComponent = new ChannelSelectMenuBuilder()
                .setCustomId(`config:set_channel:${categoryKey}:${fieldKey}`)
                .setPlaceholder(`Pilih channel untuk: ${fieldDef.name}`)
                .setChannelTypes(fieldDef.channelTypes || []);
        } else if (fieldDef.type === 'role') {
            inputComponent = new RoleSelectMenuBuilder()
                .setCustomId(`config:set_role:${categoryKey}:${fieldKey}`)
                .setPlaceholder(`Pilih role untuk: ${fieldDef.name}`);
        } else if (fieldDef.type === 'select') {
            inputComponent = new StringSelectMenuBuilder()
                .setCustomId(`config:set_select:${categoryKey}:${fieldKey}`)
                .setPlaceholder(`Pilih nilai untuk: ${fieldDef.name}`);
            
            for (const choice of fieldDef.choices) {
                const opt = new StringSelectMenuOptionBuilder()
                    .setLabel(choice.label)
                    .setValue(choice.value);
                if (choice.emoji) opt.setEmoji(choice.emoji);
                inputComponent.addOptions(opt);
            }
        } else {
            throw new Error(`Tipe input ${fieldDef.type} tidak didukung untuk halaman seleksi.`);
        }

        const rowInput = new ActionRowBuilder().addComponents(inputComponent);
        const rowNav = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`config:category:${categoryKey}`)
                .setLabel('◀️ Batal')
                .setStyle(ButtonStyle.Secondary)
        );

        return { embeds: [embed], components: [rowInput, rowNav] };
    }
}

module.exports = new ConfigPageManager();
