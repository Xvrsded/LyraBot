const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const questRegistry = require('../../services/questRegistry');
const QuestProgress = require('../../models/QuestProgress');
const QuestHistory = require('../../models/QuestHistory');
const { COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quest')
        .setDescription('Quest Platform Engine')
        // Subcommand: list
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Tampilkan daftar semua misi (quests) yang tersedia')
        )
        // Subcommand: progress
        .addSubcommand(sub =>
            sub.setName('progress')
                .setDescription('Tampilkan progres misi aktif Anda')
        )
        // Subcommand: claim
        .addSubcommand(sub =>
            sub.setName('claim')
                .setDescription('Ambil hadiah dari misi yang telah selesai')
                .addStringOption(opt =>
                    opt.setName('quest_id')
                        .setDescription('ID Misi')
                        .setRequired(true)
                )
        )
        // Subcommand: history
        .addSubcommand(sub =>
            sub.setName('history')
                .setDescription('Tampilkan riwayat penyelesaian misi Anda')
        ),

    /**
     * Executes `/quest` slash commands.
     * @param {ChatInputCommandInteraction} interaction Discord Interaction
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        if (subcommand === 'list') {
            const quests = questRegistry.getAllQuests();

            const embed = new EmbedBuilder()
                .setTitle('📜 List Quests Terdaftar')
                .setDescription('Daftar misi yang dapat Anda selesaikan untuk mendapatkan hadiah.')
                .setColor(COLORS.DEFAULT)
                .setTimestamp();

            if (quests.length === 0) {
                embed.setDescription('*Tidak ada quest yang tersedia saat ini.*');
            } else {
                quests.forEach(q => {
                    const rewardText = q.rewards.map(r => {
                        if (r.type === 'xp') return `✨ \`${r.amount} XP\``;
                        if (r.type === 'coins') return `🪙 \`${r.amount} Coins\``;
                        if (r.type === 'role') return `🎭 Role ID: <@&${r.roleId}>`;
                        return `${r.type}: ${JSON.stringify(r)}`;
                    }).join(', ');

                    embed.addFields({
                        name: `${q.title} (\`id: ${q.id}\`)`,
                        value: `• Deskripsi: *${q.description}*\n• Target: \`${q.target}\` kali\n• Hadiah: ${rewardText}`,
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'progress') {
            const activeProgress = await QuestProgress.find({ guildId, userId });

            const embed = new EmbedBuilder()
                .setTitle('🌱 Progres Quest Aktif')
                .setColor(COLORS.INFO)
                .setTimestamp();

            if (activeProgress.length === 0) {
                embed.setDescription('*Anda belum memulai quest apa pun. Lakukan aktivitas di server untuk memulai!*');
            } else {
                activeProgress.forEach(p => {
                    const quest = questRegistry.getQuest(p.questId);
                    const title = quest ? quest.title : p.questId;
                    const desc = quest ? quest.description : 'Misi kustom';
                    
                    const statusEmoji = p.completed ? '✅' : '⏳';
                    const progressPercentage = Math.min(100, Math.round((p.progress / p.target) * 100));

                    embed.addFields({
                        name: `${statusEmoji} ${title}`,
                        value: `• Deskripsi: *${desc}*\n• Progres: \`${p.progress}/${p.target}\` (\`${progressPercentage}%\`)\n• Status: ${p.completed ? '**Selesai & Diklaim**' : '**Dalam Proses**'}`,
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'claim') {
            const questId = interaction.options.getString('quest_id');
            const progress = await QuestProgress.findOne({ guildId, userId, questId });

            if (!progress) {
                return interaction.editReply('❌ Anda belum memulai misi ini.');
            }

            if (!progress.completed) {
                return interaction.editReply(`❌ Misi ini belum selesai. Progres Anda: \`${progress.progress}/${progress.target}\`.`);
            }

            // Since our QuestEngine awards rewards automatically on completion:
            return interaction.editReply('🟢 **Hadiah Telah Diklaim!** Seluruh hadiah untuk misi ini telah dikirim secara otomatis ke akun Anda saat misi selesai.');
        }

        if (subcommand === 'history') {
            const history = await QuestHistory.find({ guildId, userId }).sort({ completedAt: -1 }).limit(10);

            const embed = new EmbedBuilder()
                .setTitle('🏆 Riwayat Penyelesaian Quest')
                .setColor(COLORS.SUCCESS)
                .setTimestamp();

            if (history.length === 0) {
                embed.setDescription('*Anda belum pernah menyelesaikan quest.*');
            } else {
                history.forEach(h => {
                    const rewardText = h.rewards.map(r => {
                        if (r.type === 'xp') return `✨ \`${r.amount} XP\``;
                        if (r.type === 'coins') return `🪙 \`${r.amount} Coins\``;
                        return `${r.type}`;
                    }).join(', ');

                    embed.addFields({
                        name: `🏆 ${h.title}`,
                        value: `• Hadiah: ${rewardText}\n• Tanggal Selesai: <t:${Math.round(h.completedAt.getTime() / 1000)}:d>`,
                        inline: false
                    });
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
