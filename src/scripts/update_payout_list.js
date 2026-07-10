const User = require('../models/User');
const Config = require('../models/Config');
const { EmbedBuilder } = require('discord.js');

function startLivePayoutList(client) {
    // 10 minutes interval
    const UPDATE_INTERVAL = 10 * 60 * 1000;

    const updateLiveMessage = async () => {
        try {
            console.log('🔄 Mengupdate Live Payout List...');

            // Get config from DB
            const configDoc = await Config.findOne({ key: 'payoutListConfig' });
            if (!configDoc) {
                console.log('⚠️ Config Live Payout List belum di-setup (jalankan /setuplist). Skipping.');
                return;
            }

            const { channelId, messageId } = configDoc.value;
            
            // If the user specified a specific channel ID 1518214414254211202, we can also fallback or ensure it
            // but the /setuplist already handled it dynamically.
            
            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                console.log(`❌ Channel dengan ID ${channelId} tidak ditemukan.`);
                return;
            }

            let liveMessage;
            try {
                liveMessage = await channel.messages.fetch(messageId);
            } catch (err) {
                console.log(`❌ Pesan Live List dengan ID ${messageId} tidak ditemukan (mungkin terhapus).`);
                return;
            }

            // Dapatkan semua user verified dari DB
            const verifiedUsers = await User.find({ verified: true });
            if (verifiedUsers.length === 0) return;

            // Karena bot mungkin ada di 1 server utama, ambil guild dari channel tersebut
            const guild = channel.guild;
            // Hapus fetch semua member untuk menghindari Rate Limit (Opcode 8)
            // const members = await guild.members.fetch();

            let eligibleCount = 0;
            let notEligibleCount = 0;

            const eligibleEntries = [];
            const notEligibleEntries = [];

            for (const dbUser of verifiedUsers) {
                // Fetch member satu per satu jika tidak ada di cache
                let member = guild.members.cache.get(dbUser.discordId);
                if (!member) {
                    member = await guild.members.fetch(dbUser.discordId).catch(() => null);
                }
                
                // Kita tetap biarkan skip jika left server agar hadiah tidak diberikan ke orang yang sudah leave discord.
                if (!member) continue; 

                const joinedAt = dbUser.createdAt; // Dihitung sejak verifikasi, mewakili join community
                const diffTime = Math.abs(new Date() - joinedAt);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                // Username Roblox jika ada, jika tidak pakai username Discord
                const displayUsername = dbUser.robloxUsername || member.user.username;

                if (diffDays >= 14) {
                    // ANSI Blue color format using escape code
                    eligibleEntries.push(`\u001b[2;34m✅ ${displayUsername} \u001b[0m`);
                    eligibleCount++;
                } else {
                    const daysLeft = 14 - diffDays;
                    notEligibleEntries.push(`❌ ${displayUsername} (Kurang ${daysLeft} hari)`);
                    notEligibleCount++;
                }
            }

            // Build eligibleText within field limit (1024 characters including formatting code block tags)
            let eligibleText = '';
            let eligibleTruncated = false;
            let eligibleShown = 0;
            for (const entry of eligibleEntries) {
                // format: ```ansi\n<eligibleText><entry>\n``` -> length is: 11 + eligibleText.length + entry.length + 1
                if (12 + eligibleText.length + entry.length > 950) {
                    eligibleTruncated = true;
                    break;
                }
                eligibleText += entry + '\n';
                eligibleShown++;
            }
            if (eligibleTruncated) {
                eligibleText += `... dan ${eligibleCount - eligibleShown} member lainnya`;
            }

            // Build notEligibleText within field limit
            let notEligibleText = '';
            let notEligibleTruncated = false;
            let notEligibleShown = 0;
            for (const entry of notEligibleEntries) {
                // format: ```\n<notEligibleText><entry>\n``` -> length is: 8 + notEligibleText.length + entry.length + 1
                if (9 + notEligibleText.length + entry.length > 950) {
                    notEligibleTruncated = true;
                    break;
                }
                notEligibleText += entry + '\n';
                notEligibleShown++;
            }
            if (notEligibleTruncated) {
                notEligibleText += `... dan ${notEligibleCount - notEligibleShown} member lainnya`;
            }

            // Susun Embed
            const embed = new EmbedBuilder()
                .setTitle('📋 Live Payout Eligibility List')
                .setColor('#00ff00')
                .setDescription('Daftar member dan status kelayakan Payout Robux (Syarat 14 Hari). Message ini akan auto-update setiap 10 menit.')
                .setTimestamp();

            if (eligibleCount > 0) {
                // Dibungkus code block ansi agar warna birunya muncul
                embed.addFields({ name: `✅ Memenuhi Syarat (${eligibleCount})`, value: `\`\`\`ansi\n${eligibleText}\`\`\`` });
            } else {
                embed.addFields({ name: '✅ Memenuhi Syarat (0)', value: 'Belum ada member yang memenuhi syarat.' });
            }

            if (notEligibleCount > 0) {
                // Tidak perlu ansi block untuk yang belum memenuhi syarat jika tidak butuh warna, 
                // tapi kita pakaikan code block biasa agar rapi.
                embed.addFields({ name: `❌ Belum Memenuhi Syarat (${notEligibleCount})`, value: `\`\`\`\n${notEligibleText}\`\`\`` });
            } else {
                embed.addFields({ name: '❌ Belum Memenuhi Syarat (0)', value: 'Tidak ada member di antrean ini.' });
            }

            await liveMessage.edit({ content: null, embeds: [embed] });
            console.log('✅ Live Payout List berhasil di-update.');
            
        } catch (error) {
            console.error('❌ Error saat update Live Payout List:', error);
        }
    };

    setInterval(updateLiveMessage, UPDATE_INTERVAL);

    // Initial run
    setTimeout(() => {
        updateLiveMessage();
    }, 15000); // Tunggu 15 detik saat startup agar client siap
}

module.exports = { startLivePayoutList };
