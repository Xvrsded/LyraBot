const User = require('../models/User');

function startEligibilityChecker(client) {
    // Run the checker every 12 hours (43200000 ms)
    const CHECK_INTERVAL = 12 * 60 * 60 * 1000;

    const checkEligibility = async () => {
        try {
            console.log('🔄 Menjalankan pengecekan durasi join member (14 hari)...');
            const roleId = process.env.ELIGIBLE_ROLE_ID;
            
            if (!roleId) {
                console.log('⚠️ ELIGIBLE_ROLE_ID belum diatur di .env. Pengecekan otomatis di-skip.');
                return;
            }

            client.guilds.cache.forEach(async (guild) => {
                try {
                    // Hapus fetch seluruh member
                    // const members = await guild.members.fetch();
                    const usersToCheck = await User.find({ eligibleForPayout: false, verified: true });
                    
                    // Bulk fetch to avoid REST queue freezing
                    const userIds = usersToCheck.map(u => u.discordId);
                    for (let i = 0; i < userIds.length; i += 100) {
                        const chunk = userIds.slice(i, i + 100);
                        await guild.members.fetch({ user: chunk }).catch(() => {});
                    }

                    for (const dbUser of usersToCheck) {
                        const member = guild.members.cache.get(dbUser.discordId);
                        if (!member) continue;

                        const joinedAt = dbUser.createdAt; // Dihitung sejak verifikasi, mewakili join community
                        const diffTime = Math.abs(new Date() - joinedAt);
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays >= 14) {
                            if (!member.roles.cache.has(roleId)) {
                                await member.roles.add(roleId);
                                console.log(`✅ Member ${member.user.tag} telah diberikan role Eligible Payout.`);
                            }
                            dbUser.eligibleForPayout = true;
                            await dbUser.save();
                        }
                    }
                } catch (err) {
                    console.error(`Gagal mengecek guild ${guild.name}:`, err);
                }
            });
        } catch (error) {
            console.error('❌ Error saat menjalankan pengecekan eligibility:', error);
        }
    };

    setInterval(checkEligibility, CHECK_INTERVAL);

    // Jalankan sekali saat bot baru mulai (tunggu 10 detik agar cache guild siap)
    setTimeout(() => {
        console.log('⏳ Menginisiasi pengecekan eligibility awal...');
        checkEligibility();
    }, 10000);
}

module.exports = { startEligibilityChecker };
