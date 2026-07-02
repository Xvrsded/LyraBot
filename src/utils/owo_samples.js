module.exports = {
    // 1. Hunt completed sample
    hunt: {
        content: '**Antigravity** found a :raccoon: **Raccoon**! [Common] (HP: 12) (Level: 1)',
        author: {
            id: '282859044593598464', // OwO bot ID
            username: 'OwO',
            bot: true
        },
        guild: { id: '1505187513369624646' },
        channel: { id: '1505187513369624647' },
        mentions: {
            users: new Map() // Simulates no user mention in hunt text directly
        }
    },

    // 2. Battle completed sample
    battle: {
        content: '⚔️ | **Antigravity** vs **WinterBot**! **Antigravity** won the battle! (+15 exp)',
        author: {
            id: '282859044593598464',
            username: 'OwO',
            bot: true
        },
        guild: { id: '1505187513369624646' },
        channel: { id: '1505187513369624647' },
        mentions: {
            users: new Map()
        }
    },

    // 3. Daily claimed sample
    daily: {
        content: '💸 | **Antigravity**, kamu berhasil mengambil hadiah harian sebesar **1,500 Cowoncy**! 🐾',
        author: {
            id: '282859044593598464',
            username: 'OwO',
            bot: true
        },
        guild: { id: '1505187513369624646' },
        channel: { id: '1505187513369624647' },
        mentions: {
            users: new Map()
        }
    },

    // 4. Gem used sample
    gem: {
        content: '💎 | **Antigravity** used a :gem: **Gem 1** on their hunting team!',
        author: {
            id: '282859044593598464',
            username: 'OwO',
            bot: true
        },
        guild: { id: '1505187513369624646' },
        channel: { id: '1505187513369624647' },
        mentions: {
            users: new Map()
        }
    }
};
