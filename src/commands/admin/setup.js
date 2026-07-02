const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const templateLoader = require('../../services/templateLoader');
const templatePreview = require('../../services/templatePreview');
const setupEngine = require('../../services/setupEngine');
const interactionRouter = require('../../handlers/interactionRouter');
const logger = require('../../utils/logger');
const { COLORS } = require('../../utils/constants');

// Register button, select menu, and modal router handlers
interactionRouter.registerSelectMenu('setup:select_strategy:', async (interaction) => {
    await interaction.deferUpdate();
    const templateName = interaction.customId.split(':')[2];
    const strategy = interaction.values[0];

    const template = templateLoader.load(templateName);
    if (!template) {
        return interaction.followUp({ content: '❌ Gagal memuat preview template.', ephemeral: true });
    }

    const preview = templatePreview.generatePreview(template);
    const embed = new EmbedBuilder()
        .setTitle(`🛠️ Setup Server: ${preview.name}`)
        .setDescription(`Anda telah memilih strategi konflik: **${strategy}**.\nSilakan konfirmasi di bawah ini untuk memulai proses setup otomatis.`)
        .setColor(COLORS.WARNING)
        .addFields(
            { name: '📂 Categories', value: `\`${preview.categoriesCount}\``, inline: true },
            { name: '💬 Text Channels', value: `\`${preview.textChannelsCount}\``, inline: true },
            { name: '🔊 Voice Channels', value: `\`${preview.voiceChannelsCount}\``, inline: true },
            { name: '👥 Roles', value: `\`${preview.rolesCount}\``, inline: true },
            { name: '⏱️ Est. Setup Time', value: `\`${preview.estimatedTimeSeconds} detik\``, inline: true }
        )
        .setTimestamp();

    const rowStrategy = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`setup:select_strategy:${templateName}`)
            .setPlaceholder(`Strategi terpilih: ${strategy}`)
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Skip Existing (Recommended)').setValue('Skip').setDescription('Lewati channel/role yang sudah ada.').setDefault(strategy === 'Skip'),
                new StringSelectMenuOptionBuilder().setLabel('Replace').setValue('Replace').setDescription('Hapus channel/role bentrok lalu buat ulang.').setDefault(strategy === 'Replace'),
                new StringSelectMenuOptionBuilder().setLabel('Merge').setValue('Merge').setDescription('Gabungkan dan perbarui izin channel/role.').setDefault(strategy === 'Merge')
            )
    );

    const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`setup:confirm:${templateName}:${strategy}`)
            .setLabel('Konfirmasi & Jalankan')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🚀'),
        new ButtonBuilder()
            .setCustomId('setup:cancel')
            .setLabel('Batalkan')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
    );

    await interaction.editReply({ embeds: [embed], components: [rowStrategy, rowButtons] });
});

interactionRouter.registerButton('setup:confirm:', async (interaction) => {
    const parts = interaction.customId.split(':');
    const templateName = parts[2];
    const strategy = parts[3];

    // Defer update since progress is logged on the original message
    await interaction.deferUpdate();

    try {
        const result = await setupEngine.executeSetup(interaction.guild, templateName, strategy, interaction);

        if (result.success) {
            const summaryEmbed = new EmbedBuilder()
                .setTitle('✅ Setup Server Selesai!')
                .setDescription('Template telah sukses diintegrasikan ke server Anda.')
                .setColor(COLORS.SUCCESS)
                .addFields(
                    { name: '⏱️ Setup Duration', value: `\`${result.summary.setupTime}\``, inline: true },
                    { name: '📂 Categories Created', value: `\`${result.summary.categoriesCreated}\``, inline: true },
                    { name: '💬 Channels Created', value: `\`${result.summary.channelsCreated}\``, inline: true },
                    { name: '👥 Roles Created', value: `\`${result.summary.rolesCreated}\``, inline: true },
                    { name: '🔄 Objects Updated', value: `\`${result.summary.objectsUpdated}\``, inline: true },
                    { name: '⏭️ Objects Skipped', value: `\`${result.summary.objectsSkipped}\``, inline: true }
                )
                .setTimestamp();
            
            if (result.summary.warnings.length > 0) {
                summaryEmbed.addFields({ name: '⚠️ Peringatan', value: result.summary.warnings.join('\n') });
            }

            await interaction.editReply({ content: '🎉 **Proses Auto Setup Sukses!**', embeds: [summaryEmbed], components: [] });
        } else {
            // Failure (with rollback)
            const failEmbed = new EmbedBuilder()
                .setTitle('❌ Setup Gagal & Dilakukan Rollback')
                .setDescription('Terjadi kegagalan kritis saat proses instalasi. Bot telah memulihkan server ke kondisi semula.')
                .setColor(COLORS.DANGER)
                .addFields(
                    { name: '❌ Fatal Errors', value: result.summary.errors.join('\n') || 'Unknown error' },
                    { name: '🧹 Rollback Channels Reverted', value: `\`${result.rollbackReport?.channelsDeleted || 0}\``, inline: true },
                    { name: '👥 Rollback Roles Reverted', value: `\`${result.rollbackReport?.rolesDeleted || 0}\``, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ content: '❌ **Auto Setup Gagal!**', embeds: [failEmbed], components: [] });
        }
    } catch (err) {
        logger.error('[Setup Command Error]', err);
        await interaction.followUp({ content: `❌ Gagal menjalankan setup: ${err.message}`, ephemeral: true });
    }
});

interactionRouter.registerButton('setup:cancel', async (interaction) => {
    await interaction.deferUpdate();
    await interaction.editReply({ content: '❌ **Auto Setup dibatalkan oleh Administrator.**', embeds: [], components: [] });
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Enterprise Auto Setup Server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('template')
                .setDescription('Nama template server yang ingin diinstall')
                .setRequired(true)
                .addChoices(
                    { name: 'OwO Community Server', value: 'owo' },
                    { name: 'Roblox Store Server', value: 'roblox_store' }
                )
        ),

    /**
     * Executes the `/setup` slash command.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction object
     * @returns {Promise<any>}
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const templateName = interaction.options.getString('template');
        const guild = interaction.guild;

        // 1. Verify permissions first
        const permCheck = setupEngine.verifyPermissions(guild);
        if (!permCheck.allowed) {
            return interaction.editReply({
                content: `❌ **Bot kekurangan izin perizinan berikut di server untuk melanjutkan:**\n- ${permCheck.missing.join('\n- ')}\n\n*Harap berikan hak akses di atas lalu jalankan kembali command.*`
            });
        }

        // 2. Load template
        const template = templateLoader.load(templateName);
        if (!template) {
            return interaction.editReply({ content: `❌ Template \`${templateName}\` tidak ditemukan atau gagal dimuat.` });
        }

        // 3. Generate preview info
        const preview = templatePreview.generatePreview(template);
        const embed = new EmbedBuilder()
            .setTitle(`🛠️ Setup Server: ${preview.name}`)
            .setDescription(`${preview.description}\n\nPilih strategi resolusi konflik di bawah untuk melihat pilihan konfirmasi setup.`)
            .setColor(COLORS.INFO)
            .addFields(
                { name: '📂 Categories', value: `\`${preview.categoriesCount}\``, inline: true },
                { name: '💬 Text Channels', value: `\`${preview.textChannelsCount}\``, inline: true },
                { name: '🔊 Voice Channels', value: `\`${preview.voiceChannelsCount}\``, inline: true },
                { name: '👥 Roles', value: `\`${preview.rolesCount}\``, inline: true },
                { name: '⏱️ Est. Setup Time', value: `\`${preview.estimatedTimeSeconds} detik\``, inline: true }
            )
            .setTimestamp();

        // 4. Offer conflict resolution strategy selector
        const rowStrategy = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`setup:select_strategy:${templateName}`)
                .setPlaceholder('Pilih resolusi konflik...')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Skip Existing (Recommended)').setValue('Skip').setDescription('Lewati channel/role yang sudah ada.'),
                    new StringSelectMenuOptionBuilder().setLabel('Replace').setValue('Replace').setDescription('Hapus channel/role bentrok lalu buat ulang.'),
                    new StringSelectMenuOptionBuilder().setLabel('Merge').setValue('Merge').setDescription('Gabungkan dan perbarui izin channel/role.')
                )
        );

        return interaction.editReply({ embeds: [embed], components: [rowStrategy] });
    }
};
