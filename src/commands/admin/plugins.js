const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const pluginManager = require('../../services/pluginManager');
const interactionRouter = require('../../handlers/interactionRouter');
const logger = require('../../utils/logger');
const { COLORS } = require('../../utils/constants');

// Register button & modal handlers to central InteractionRouter
interactionRouter.registerButton('plugins:reload_btn', async (interaction) => {
    const modal = new ModalBuilder()
        .setCustomId('plugins:reload_modal')
        .setTitle('Reload Plugin');

    const input = new TextInputBuilder()
        .setCustomId('plugin_name')
        .setLabel('Masukkan Nama Plugin')
        .setPlaceholder('Contoh: test-plugin')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
});

interactionRouter.registerButton('plugins:disable_btn', async (interaction) => {
    const modal = new ModalBuilder()
        .setCustomId('plugins:disable_modal')
        .setTitle('Nonaktifkan Plugin');

    const input = new TextInputBuilder()
        .setCustomId('plugin_name')
        .setLabel('Masukkan Nama Plugin')
        .setPlaceholder('Contoh: test-plugin')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
});

interactionRouter.registerModal('plugins:reload_modal', async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.fields.getTextInputValue('plugin_name');

    if (!pluginManager.getPlugins().has(name)) {
        return interaction.editReply(`❌ Plugin bernama \`${name}\` tidak terdaftar.`);
    }

    try {
        await pluginManager.reload(name);
        
        // Refresh overview message if it exists
        if (interaction.message) {
            const embed = buildOverviewEmbed(interaction.guild);
            await interaction.message.edit({ embeds: [embed] }).catch(err => {
                logger.warn('[Plugins Command] Failed to edit parent message:', err.message);
            });
        }
        await interaction.editReply(`✅ Plugin \`${name}\` berhasil di-reload di memori bot!`);
    } catch (err) {
        logger.error('[Plugins Reload Error]', err);
        await interaction.editReply(`❌ Gagal mereload plugin: ${err.message}`);
    }
});

interactionRouter.registerModal('plugins:disable_modal', async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.fields.getTextInputValue('plugin_name');

    if (!pluginManager.getPlugins().has(name)) {
        return interaction.editReply(`❌ Plugin bernama \`${name}\` tidak terdaftar.`);
    }

    try {
        await pluginManager.disable(name);
        
        if (interaction.message) {
            const embed = buildOverviewEmbed(interaction.guild);
            await interaction.message.edit({ embeds: [embed] }).catch(err => {
                logger.warn('[Plugins Command] Failed to edit parent message:', err.message);
            });
        }
        await interaction.editReply(`✅ Plugin \`${name}\` berhasil dinonaktifkan!`);
    } catch (err) {
        logger.error('[Plugins Disable Error]', err);
        await interaction.editReply(`❌ Gagal menonaktifkan plugin: ${err.message}`);
    }
});

/**
 * Builds the plugin list overview embed.
 * @param {Guild} guild 
 * @returns {EmbedBuilder}
 */
function buildOverviewEmbed(guild) {
    const embed = new EmbedBuilder()
        .setTitle('🔌 Plugin Management Platform')
        .setDescription('Daftar plugin modular yang terdeteksi pada sistem bot. Administrator dapat melakukan reload secara dinamis.')
        .setColor(COLORS.DEFAULT)
        .setTimestamp();

    const plugins = pluginManager.getPlugins();
    if (plugins.size === 0) {
        embed.setDescription('❌ Tidak ada plugin yang terdeteksi di folder `src/plugins`.');
    } else {
        for (const [name, meta] of plugins.entries()) {
            const status = pluginManager.activeStatus.get(name) === 'enabled' ? '🟢 Enabled' : '🔴 Disabled';
            const deps = meta.dependencies && meta.dependencies.length > 0 ? meta.dependencies.join(', ') : 'None';
            embed.addFields({
                name: `${meta.name || name} (v${meta.version || '1.0.0'})`,
                value: `• ID: \`${name}\`\n• Deskripsi: *${meta.description || 'Tidak ada deskripsi'}*\n• Status: **${status}**\n• Dependencies: \`${deps}\`\n• Author: *${meta.author || 'Unknown'}*`,
                inline: false
            });
        }
    }
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('plugins')
        .setDescription('Plugin Management System')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    /**
     * Executes the `/plugins` slash command.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction
     * @returns {Promise<any>}
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const embed = buildOverviewEmbed(interaction.guild);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('plugins:reload_btn')
                .setLabel('Reload Plugin')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄'),
            new ButtonBuilder()
                .setCustomId('plugins:disable_btn')
                .setLabel('Disable Plugin')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️')
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    }
};
