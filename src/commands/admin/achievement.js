const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const achievementRegistry = require('../../services/achievementRegistry');
const MemberProgression = require('../../models/MemberProgression');
const AchievementProgress = require('../../models/AchievementProgress');
const { COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievement')
        .setDescription('Progression and Achievements platform')
        // Subcommand: list
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Tampilkan semua achievement terdaftar')
        )
        // Subcommand: progress
        .addSubcommand(sub =>
            sub.setName('progress')
                .setDescription('Tampilkan progres achievement Anda')
        )
        // Subcommand: titles
        .addSubcommand(sub =>
            sub.setName('titles')
                .setDescription('Tampilkan daftar gelar (titles) Anda')
        )
        // Subcommand: use_title
        .addSubcommand(sub =>
            sub.setName('use_title')
                .setDescription('Pasang gelar aktif profil Anda')
                .addStringOption(opt =>
                    opt.setName('title')
                        .setDescription('Gelar yang ingin digunakan')
                        .setRequired(true)
                )
        )
        // Subcommand: badges
        .addSubcommand(sub =>
            sub.setName('badges')
                .setDescription('Tampilkan daftar lencana (badges) Anda')
        )
        // Subcommand: leaderboard
        .addSubcommand(sub =>
            sub.setName('leaderboard')
                .setDescription('Tampilkan papan peringkat poin achievement')
        ),

    /**
     * Executes `/achievement` slash commands.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        if (subcommand === 'list') {
            const achievements = achievementRegistry.getAllAchievements();

            const embed = new EmbedBuilder()
                .setTitle('🏆 Achievements List')
                .setDescription('Daftar pencapaian yang dapat Anda buka di server ini.')
                .setColor(COLORS.DEFAULT)
                .setTimestamp();

            if (achievements.length === 0) {
                embed.setDescription('*Tidak ada achievement terdaftar saat ini.*');
            } else {
                achievements.forEach(a => {
                    const rewardsText = a.rewards.map(r => {
                        if (r.type === 'badge') return `📛 \`${r.badge}\``;
                        if (r.type === 'title') return `👑 gelar \`[${r.title}]\``;
                        return `${r.type}`;
                    }).join(', ');

                    embed.addFields({
                        name: `${a.title} [${a.rarity}] (${a.points} Poin)`,
                        value: `• Deskripsi: *${a.description}*\n• Target: \`${a.target}\` kali\n• Hadiah: ${rewardsText}`,
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'progress') {
            const progressList = await AchievementProgress.find({ guildId, userId });

            const embed = new EmbedBuilder()
                .setTitle('📊 Progres Achievement Anda')
                .setColor(COLORS.INFO)
                .setTimestamp();

            if (progressList.length === 0) {
                embed.setDescription('*Anda belum memulai progres pencapaian apa pun. Berpartisipasilah di server!*');
            } else {
                progressList.forEach(p => {
                    const ach = achievementRegistry.getAchievement(p.achievementId);
                    const title = ach ? ach.title : p.achievementId;
                    const desc = ach ? ach.description : 'Pencapaian kustom';
                    const rarity = ach ? `[${ach.rarity}]` : '';

                    const statusEmoji = p.completed ? '✅' : '⏳';
                    const pct = Math.min(100, Math.round((p.progress / p.target) * 100));

                    embed.addFields({
                        name: `${statusEmoji} ${title} ${rarity}`,
                        value: `• Deskripsi: *${desc}*\n• Progres: \`${p.progress}/${p.target}\` (\`${pct}%\`)\n• Status: ${p.completed ? '**Selesai Unlocked**' : '**Terkunci**'}`,
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'titles') {
            const prog = await MemberProgression.findOne({ guildId, userId });
            const unlocked = prog ? prog.titles : [];
            const active = prog ? prog.activeTitle : '';

            const embed = new EmbedBuilder()
                .setTitle('👑 Gelar Unlocked Profil Anda')
                .setColor(COLORS.SUCCESS)
                .setTimestamp();

            if (unlocked.length === 0) {
                embed.setDescription('*Anda belum membuka gelar apa pun. Selesaikan pencapaian untuk membukanya!*');
            } else {
                const list = unlocked.map(t => {
                    const isActive = t === active ? ' **(AKTIF)** 🟢' : '';
                    return `• \`[${t}]\`${isActive}`;
                }).join('\n');
                embed.setDescription(list);
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'use_title') {
            const chosen = interaction.options.getString('title');
            const prog = await MemberProgression.findOne({ guildId, userId });

            if (!prog || !prog.titles.includes(chosen)) {
                return interaction.editReply('❌ Anda belum membuka gelar tersebut atau gelar tidak valid.');
            }

            prog.activeTitle = chosen;
            await prog.save();

            return interaction.editReply(`🟢 **Gelar Diperbarui**: Gelar aktif Anda sekarang disetel ke \`[${chosen}]\`.`);
        }

        if (subcommand === 'badges') {
            const prog = await MemberProgression.findOne({ guildId, userId });
            const badges = prog ? prog.badges : [];

            const embed = new EmbedBuilder()
                .setTitle('📛 Lencana (Badges) Anda')
                .setColor(COLORS.DEFAULT)
                .setTimestamp();

            if (badges.length === 0) {
                embed.setDescription('*Anda belum memiliki lencana apa pun.*');
            } else {
                const badgeList = badges.map((b, idx) => `${idx + 1}. ${b}`).join('\n');
                embed.setDescription(badgeList);
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'leaderboard') {
            const topUsers = await MemberProgression.find({ guildId }).sort({ achievementPoints: -1 }).limit(10);

            const embed = new EmbedBuilder()
                .setTitle('🏆 Leaderboard Achievement Points')
                .setColor(COLORS.SUCCESS)
                .setTimestamp();

            if (topUsers.length === 0) {
                embed.setDescription('*Belum ada data skor pemain.*');
            } else {
                const rows = topUsers.map((u, idx) => {
                    const activeTitleStr = u.activeTitle ? ` \`[${u.activeTitle}]\`` : '';
                    return `**#${idx + 1}** | <@${u.userId}>${activeTitleStr} - \`${u.achievementPoints} Poin\` (Lvl \`${u.level}\`)`;
                }).join('\n');
                embed.setDescription(rows);
            }

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
