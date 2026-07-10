const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const WelcomeConfig = require('../../models/WelcomeConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure the server welcome system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Initialize or view the current welcome configuration.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set the channel for welcome messages.')
                .addChannelOption(option =>
                    option.setName('target')
                        .setDescription('The channel to send welcome messages in.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('message')
                .setDescription('Set the welcome message content.')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Variables: {user}, {username}, {server}, {membercount}')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('gif')
                .setDescription('Set the welcome GIF URL.')
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('The URL of the GIF/image.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('Set the auto-role given to new members.')
                .addRoleOption(option =>
                    option.setName('target')
                        .setDescription('The role to assign.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Turn the welcome system on or off.')
                .addBooleanOption(option =>
                    option.setName('state')
                        .setDescription('True for on, False for off.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Simulate a user joining to test the welcome system.')
        ),

    async execute(interaction) {
        const { guild } = interaction;
        const subcommand = interaction.options.getSubcommand();

        try {
            await interaction.deferReply({ ephemeral: true });

            let config = await WelcomeConfig.findOne({ guildId: guild.id });
            
            if (!config) {
                config = await WelcomeConfig.create({ guildId: guild.id });
            }

            if (subcommand === 'setup') {
                const embed = new EmbedBuilder()
                    .setTitle(`Welcome Configuration for ${guild.name}`)
                    .setColor('#00ff00')
                    .addFields(
                        { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                        { name: 'Channel', value: config.channelId ? `<#${config.channelId}>` : 'Not set', inline: true },
                        { name: 'Auto Role', value: config.autoRole ? `<@&${config.autoRole}>` : 'Not set', inline: true },
                        { name: 'Message', value: config.message || 'Default' },
                        { name: 'GIF', value: config.welcomeGif ? `[Link](${config.welcomeGif})` : 'Not set' }
                    )
                    .setTimestamp();
                
                if (config.welcomeGif) {
                    embed.setImage(config.welcomeGif);
                }

                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === 'channel') {
                const channel = interaction.options.getChannel('target');
                config.channelId = channel.id;
                await config.save();

                // Sync with central GuildConfig
                const configService = require('../../services/configService');
                await configService.updateConfig(guild.id, 'channels.welcome', channel.id);

                return interaction.editReply({ content: `✅ Welcome channel has been set to ${channel}.` });
            }

            if (subcommand === 'message') {
                const text = interaction.options.getString('text');
                config.message = text;
                await config.save();

                // Sync with central GuildConfig
                const configService = require('../../services/configService');
                await configService.updateConfig(guild.id, 'welcome.message', text);

                return interaction.editReply({ content: `✅ Welcome message has been updated.\nPreview:\n${text}` });
            }

            if (subcommand === 'gif') {
                const url = interaction.options.getString('url');
                // Basic URL validation
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    return interaction.editReply({ content: '❌ Please provide a valid URL starting with http:// or https://' });
                }
                config.welcomeGif = url;
                await config.save();

                // Sync with central GuildConfig
                const configService = require('../../services/configService');
                await configService.updateConfig(guild.id, 'welcome.welcomeGif', url);

                return interaction.editReply({ content: `✅ Welcome GIF has been updated.` });
            }

            if (subcommand === 'role') {
                const role = interaction.options.getRole('target');
                
                // Check if bot's highest role is above the target role
                const botMember = await guild.members.fetch(interaction.client.user.id);
                if (role.position >= botMember.roles.highest.position) {
                    return interaction.editReply({ content: `❌ I cannot assign this role because it is higher or equal to my highest role.` });
                }

                config.autoRole = role.id;
                await config.save();

                // Sync with central GuildConfig
                const configService = require('../../services/configService');
                await configService.updateConfig(guild.id, 'welcome.autoRole', role.id);

                return interaction.editReply({ content: `✅ Auto-role has been set to ${role}.` });
            }

            if (subcommand === 'toggle') {
                const state = interaction.options.getBoolean('state');
                config.enabled = state;
                await config.save();

                // Sync with central GuildConfig
                const configService = require('../../services/configService');
                await configService.updateConfig(guild.id, 'welcome.enabled', state);

                return interaction.editReply({ content: `✅ Welcome system has been turned ${state ? '**ON**' : '**OFF**'}.` });
            }

            if (subcommand === 'test') {
                // Simulate guildMemberAdd by emitting the event with the user who ran the command
                interaction.client.emit('guildMemberAdd', interaction.member);
                return interaction.editReply({ content: `✅ Simulated a new member joining! Check your welcome channel to see the result.` });
            }
        } catch (error) {
            console.error('Welcome Command Error:', error);
            if (interaction.deferred) {
                return interaction.editReply({ content: '❌ An error occurred while executing this command.' });
            } else {
                return interaction.reply({ content: '❌ An error occurred while executing this command.', ephemeral: true });
            }
        }
    },
};
