const interactionRouter = require('./interactionRouter');
const configService = require('../services/configService');
const configPageManager = require('../services/configPageManager');
const configDefinitions = require('../utils/configDefinitions');
const validators = require('../utils/validators');
const logger = require('../utils/logger');

// 1. Dashboard category button clicks (e.g. config_btn_general)
interactionRouter.registerButton('config_btn_', async (interaction) => {
    await interaction.deferUpdate();
    const categoryKey = interaction.customId.replace('config_btn_', '');
    const config = await configService.getConfig(interaction.guildId);
    const payload = configPageManager.getCategoryPagePayload(interaction.guild, config, categoryKey);
    await interaction.editReply(payload);
});

// 2. Back to main dashboard button click
interactionRouter.registerButton('config:dashboard', async (interaction) => {
    await interaction.deferUpdate();
    const config = await configService.getConfig(interaction.guildId);
    const payload = configPageManager.getDashboardPayload(interaction.guild, config);
    await interaction.editReply(payload);
});

// 3. Back to category detail page button click
interactionRouter.registerButton('config:category:', async (interaction) => {
    await interaction.deferUpdate();
    const categoryKey = interaction.customId.split(':')[2];
    const config = await configService.getConfig(interaction.guildId);
    const payload = configPageManager.getCategoryPagePayload(interaction.guild, config, categoryKey);
    await interaction.editReply(payload);
});

// 4. Reset category to defaults button click
interactionRouter.registerButton('config:reset:', async (interaction) => {
    await interaction.deferUpdate();
    const categoryKey = interaction.customId.split(':')[2];
    const categoryDef = configDefinitions[categoryKey];
    if (!categoryDef) return;

    const config = await configService.getConfig(interaction.guildId);
    for (const [fieldKey, fieldDef] of Object.entries(categoryDef.fields)) {
        await configService.updateConfig(interaction.guildId, fieldDef.path, fieldDef.default);
    }

    const updatedConfig = await configService.getConfig(interaction.guildId);
    const payload = configPageManager.getCategoryPagePayload(interaction.guild, updatedConfig, categoryKey);
    await interaction.editReply(payload);
});

// 5. Select field to edit dropdown trigger
interactionRouter.registerSelectMenu('config:select_field:', async (interaction) => {
    const categoryKey = interaction.customId.split(':')[2];
    const fieldKey = interaction.values[0];
    const categoryDef = configDefinitions[categoryKey];
    const fieldDef = categoryDef?.fields[fieldKey];

    if (!fieldDef) return;
    const config = await configService.getConfig(interaction.guildId);

    // Route based on type
    if (fieldDef.type === 'boolean') {
        // Toggle immediately
        await interaction.deferUpdate();
        const currentVal = config.get(fieldDef.path);
        await configService.updateConfig(interaction.guildId, fieldDef.path, !currentVal);

        const updatedConfig = await configService.getConfig(interaction.guildId);
        const payload = configPageManager.getCategoryPagePayload(interaction.guild, updatedConfig, categoryKey);
        await interaction.editReply(payload);
    } else if (fieldDef.type === 'channel' || fieldDef.type === 'role' || fieldDef.type === 'select') {
        // Open appropriate select menu
        await interaction.deferUpdate();
        const payload = configPageManager.getFieldEditPayload(interaction.guild, config, categoryKey, fieldKey);
        await interaction.editReply(payload);
    } else if (fieldDef.type === 'string' || fieldDef.type === 'number') {
        // Open input text Modal
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
            .setCustomId(`config:modal:${categoryKey}:${fieldKey}`)
            .setTitle(`Edit: ${fieldDef.name}`);

        const currentVal = config.get(fieldDef.path);
        const input = new TextInputBuilder()
            .setCustomId('input_value')
            .setLabel(fieldDef.name)
            .setPlaceholder(fieldDef.placeholder || 'Masukkan nilai baru...')
            .setStyle(fieldDef.type === 'string' && fieldDef.name.includes('Pesan') ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(true);

        if (currentVal !== null && currentVal !== undefined) {
            input.setValue(String(currentVal));
        }

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }
});

// 6. Generic submission handlers for Select Menus
const handleSelectionSubmit = async (interaction, type) => {
    await interaction.deferUpdate();
    const parts = interaction.customId.split(':');
    const categoryKey = parts[2];
    const fieldKey = parts[3];
    const categoryDef = configDefinitions[categoryKey];
    const fieldDef = categoryDef?.fields[fieldKey];
    if (!fieldDef) return;

    const value = interaction.values[0];

    // Validate
    if (type === 'channel' && !validators.isValidChannel(interaction.guild, value, fieldDef.channelTypes)) {
        return interaction.followUp({ content: '❌ Channel tidak valid atau tipenya tidak didukung.', ephemeral: true });
    }
    if (type === 'role' && !validators.isValidRole(interaction.guild, value)) {
        return interaction.followUp({ content: '❌ Role tidak valid.', ephemeral: true });
    }

    await configService.updateConfig(interaction.guildId, fieldDef.path, value);
    const updatedConfig = await configService.getConfig(interaction.guildId);
    const payload = configPageManager.getCategoryPagePayload(interaction.guild, updatedConfig, categoryKey);
    await interaction.editReply(payload);
};

interactionRouter.registerSelectMenu('config:set_channel:', (i) => handleSelectionSubmit(i, 'channel'));
interactionRouter.registerSelectMenu('config:set_role:', (i) => handleSelectionSubmit(i, 'role'));
interactionRouter.registerSelectMenu('config:set_select:', (i) => handleSelectionSubmit(i, 'select'));

// 7. Generic modal submit handlers for Strings and Numbers
interactionRouter.registerModal('config:modal:', async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const parts = interaction.customId.split(':');
    const categoryKey = parts[2];
    const fieldKey = parts[3];
    const categoryDef = configDefinitions[categoryKey];
    const fieldDef = categoryDef?.fields[fieldKey];
    if (!fieldDef) return interaction.editReply('❌ Kategori atau field tidak ditemukan.');

    const rawVal = interaction.fields.getTextInputValue('input_value');
    let finalVal = rawVal;

    // Validate type conversions
    if (fieldDef.type === 'number') {
        const num = Number(rawVal);
        if (isNaN(num)) {
            return interaction.editReply('❌ Input harus berupa angka valid.');
        }
        finalVal = num;
    }

    // Run custom validators from definitions
    if (fieldDef.validation) {
        const validationResult = fieldDef.validation(finalVal);
        if (validationResult !== true) {
            return interaction.editReply(`❌ **Validasi Gagal:** ${validationResult}`);
        }
    }

    // Save and update cache
    await configService.updateConfig(interaction.guildId, fieldDef.path, finalVal);

    // Refresh original command overview embed if possible
    if (interaction.message) {
        const updatedConfig = await configService.getConfig(interaction.guildId);
        const payload = configPageManager.getCategoryPagePayload(interaction.guild, updatedConfig, categoryKey);
        await interaction.message.edit(payload).catch(err => {
            logger.warn('[configInteractionHandler] Failed to update parent message:', err.message);
        });
    }

    await interaction.editReply('✅ Pengaturan berhasil disimpan!');
});
