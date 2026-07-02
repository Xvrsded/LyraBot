const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const configService = require('../../services/configService');
const configPageManager = require('../../services/configPageManager');

// Load interactive configuration framework handlers on command load
require('../../handlers/configInteractionHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Server Configuration System')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild),
        
    /**
     * Executes the `/config` slash command.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction object
     * @returns {Promise<any>}
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const config = await configService.getConfig(guildId);
        
        const payload = configPageManager.getDashboardPayload(interaction.guild, config);
        return interaction.editReply(payload);
    }
};
