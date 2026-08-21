const Config = require('../models/Config');
const { generateLeaderboardEmbed } = require('../services/leaderboardHelper');

let updateLeaderboardFn = null;

function startLiveLeaderboard(client) {
    // 10 minutes fallback interval
    const UPDATE_INTERVAL = 10 * 60 * 1000;
    const CHANNEL_ID = '1473251746259402867';

    const updateLeaderboardMessage = async () => {
        try {
            console.log('🔄 Mengupdate Live Leaderboard...');

            // Get or create config from DB
            let configDoc = await Config.findOne({ key: 'leaderboardConfig' });
            if (!configDoc) {
                configDoc = await Config.create({
                    key: 'leaderboardConfig',
                    value: { channelId: CHANNEL_ID, messageId: null }
                });
            }

            const channelId = configDoc.value.channelId || CHANNEL_ID;
            let messageId = configDoc.value.messageId;

            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                console.log(`❌ Channel dengan ID ${channelId} tidak ditemukan.`);
                return;
            }

            // Generate the embed from the helper (same as button click)
            const result = await generateLeaderboardEmbed(null, 'alltime');

            let liveMessage = null;
            if (messageId) {
                try {
                    liveMessage = await channel.messages.fetch(messageId);
                } catch (err) {
                    console.log(`❌ Pesan Leaderboard dengan ID ${messageId} tidak ditemukan, membuat pesan baru.`);
                }
            }

            if (liveMessage) {
                await liveMessage.edit({ embeds: [result.embed], components: [result.row] });
                console.log('✅ Live Leaderboard berhasil di-update.');
            } else {
                const sentMessage = await channel.send({ embeds: [result.embed], components: [result.row] });
                configDoc.value.messageId = sentMessage.id;
                configDoc.markModified('value');
                await configDoc.save();
                console.log('✅ Live Leaderboard baru berhasil dikirim dan ID disimpan.');
            }

        } catch (error) {
            console.error('❌ Error saat update Live Leaderboard:', error);
        }
    };

    updateLeaderboardFn = updateLeaderboardMessage;
    setInterval(updateLeaderboardMessage, UPDATE_INTERVAL);

    // Initial run after startup (10s delay to let client connect)
    setTimeout(() => {
        updateLeaderboardMessage();
    }, 10000);
}

async function triggerLeaderboardUpdate() {
    if (updateLeaderboardFn) {
        console.log('⚡ Triggering instant leaderboard update...');
        await updateLeaderboardFn().catch(console.error);
    } else {
        console.log('⚠️ updateLeaderboardFn not initialized yet.');
    }
}

module.exports = { startLiveLeaderboard, triggerLeaderboardUpdate };
