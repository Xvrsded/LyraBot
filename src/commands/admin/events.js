const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const eventBus = require('../../services/eventBus');
const { COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('events')
        .setDescription('Inspect recent cross-plugin Event Bus traffic logs')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    /**
     * Executes the `/events` slash command.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('📡 Event Bus Traffic Monitoring')
            .setDescription('Menampilkan 15 aktivitas transmisi Event Bus lintas-plugin terakhir.')
            .setColor(COLORS.DEFAULT)
            .setTimestamp();

        const logs = eventBus.recentEvents;
        if (logs.length === 0) {
            embed.setDescription('*Tidak ada lalu lintas Event Bus yang tercatat.*');
        } else {
            // Display last 15 in descending order (most recent first)
            const recentLogs = [...logs].reverse().slice(0, 15);
            recentLogs.forEach((log, idx) => {
                const age = Math.round((Date.now() - log.timestamp.getTime()) / 1000);
                embed.addFields({
                    name: `#${idx + 1} - 📡 ${log.eventName}`,
                    value: `• Origin: \`plugin:${log.plugin}\`\n• Correlation: \`${log.correlationId}\`\n• Waktu: \`${age}s ago\`\n• Payload: \`${JSON.stringify(log.payload)}\``,
                    inline: false
                });
            });
        }

        return interaction.editReply({ embeds: [embed] });
    }
};
