const noblox = require('noblox.js');

async function verifyRobloxUsername(username) {
    try {
        const id = await noblox.getIdFromUsername(username);
        return { success: true, id, username };
    } catch (error) {
        return { success: false, error: 'Username Roblox tidak ditemukan' };
    }
}

async function getRobloxUserInfo(username) {
    try {
        // 1. Get user ID and Display Name
        const userRes = await fetch(`https://users.roblox.com/v1/usernames/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
        });
        const userData = await userRes.json();
        
        if (!userData || !userData.data || userData.data.length === 0) {
            return { success: false, error: 'Username Roblox tidak ditemukan.' };
        }
        
        const user = userData.data[0];
        
        // 2. Get Avatar Headshot
        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=420x420&format=Png&isCircular=false`);
        const thumbData = await thumbRes.json();
        
        let avatarUrl = null;
        if (thumbData && thumbData.data && thumbData.data.length > 0) {
            avatarUrl = thumbData.data[0].imageUrl;
        }

        return { 
            success: true, 
            id: user.id, 
            username: user.name, 
            displayName: user.displayName,
            avatarUrl 
        };
    } catch (error) {
        return { success: false, error: 'Terjadi kesalahan saat menghubungi API Roblox.' };
    }
}

module.exports = {
    verifyRobloxUsername,
    getRobloxUserInfo
};
