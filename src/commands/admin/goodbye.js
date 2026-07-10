const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const WelcomeConfig = require('../../models/WelcomeConfig');
const LeaveConfig = require('../../models/LeaveConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('goodbye')
        .setDescription('Cek status sistem goodbye otomatis.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Cek status dan channel untuk sistem goodbye.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('testing')
                .setDescription('Simulasikan ada member keluar untuk testing.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set channel khusus untuk goodbye.')
                .addChannelOption(option => 
                    option.setName('channel')
                        .setDescription('Channel tempat mengirim pesan goodbye')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const { guild } = interaction;
        const subcommand = interaction.options.getSubcommand();

        try {
            await interaction.deferReply({ ephemeral: true });

            if (subcommand === 'status') {
                let targetChannel = null;
                let channelSource = '';

                const leaveConfig = await LeaveConfig.findOne({ guildId: guild.id });
                if (leaveConfig && leaveConfig.channelId) {
                    targetChannel = guild.channels.cache.get(leaveConfig.channelId);
                    channelSource = 'Channel khusus (Disetup via /goodbye setup)';
                }

                if (!targetChannel) {
                    targetChannel = guild.channels.cache.find(c => 
                        c.name.toLowerCase().includes('goodbye') || 
                        c.name.toLowerCase().includes('leave') ||
                        c.name.toLowerCase().includes('keluar') ||
                        c.name.toLowerCase().includes('out')
                    );
                    if (targetChannel) channelSource = 'Channel otomatis dengan nama goodbye/leave';
                }

                if (!targetChannel) {
                    const welcomeConfig = await WelcomeConfig.findOne({ guildId: guild.id });
                    if (welcomeConfig && welcomeConfig.channelId) {
                        targetChannel = guild.channels.cache.get(welcomeConfig.channelId);
                        channelSource = 'Channel Welcome (Fallback otomatis)';
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle(`⚙️ Sistem Goodbye Otomatis`)
                    .setColor('#ff0000')
                    .setDescription('Sistem goodbye saat ini sudah dibuat **OTOMATIS** dan tidak perlu disetup manual. Layout, pesan, dan GIF akan sama dengan sistem Welcome.')
                    .addFields(
                        { name: 'Channel Target', value: targetChannel ? `<#${targetChannel.id}>` : '❌ Tidak Ditemukan', inline: true },
                        { name: 'Sumber Channel', value: channelSource, inline: true }
                    )
                    .setFooter({ text: 'Jika target tidak ditemukan, buat channel khusus (misal "goodbye") atau setup channel di /welcome.' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === 'testing') {
                // Simulate guildMemberRemove
                interaction.client.emit('guildMemberRemove', interaction.member);
                return interaction.editReply({ content: `✅ Simulasi berhasil! Cek channel goodbye/welcome untuk melihat hasilnya.` });
            }

            if (subcommand === 'setup') {
                const channel = interaction.options.getChannel('channel');

                let leaveConfig = await LeaveConfig.findOne({ guildId: guild.id });
                if (!leaveConfig) {
                    leaveConfig = new LeaveConfig({ guildId: guild.id });
                }

                leaveConfig.channelId = channel.id;
                await leaveConfig.save();

                // Sync with central GuildConfig
                const configService = require('../../services/configService');
                await configService.updateConfig(guild.id, 'channels.goodbye', channel.id);

                return interaction.editReply({ content: `✅ Berhasil mengatur channel goodbye ke <#${channel.id}>. Coba /goodbye testing untuk mencoba.` });
            }
        } catch (error) {
            console.error('Goodbye Command Error:', error);
            if (interaction.deferred) {
                return interaction.editReply({ content: '❌ Terjadi error saat mengeksekusi command.' });
            } else {
                return interaction.reply({ content: '❌ Terjadi error saat mengeksekusi command.', ephemeral: true });
            }
        }
    },
};

