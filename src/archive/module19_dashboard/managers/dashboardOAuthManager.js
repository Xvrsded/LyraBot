/**
 * dashboardOAuthManager.js — Handles Discord OAuth2 flows and JWT creation
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'mock_client_id';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'mock_client_secret';
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/v1/dashboard/auth/discord/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

class DashboardOAuthManager {
    /**
     * Generates the Discord OAuth2 login URL
     */
    getLoginUrl() {
        const scopes = 'identify guilds';
        return `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
    }

    /**
     * Exchanges an authorization code for a Discord access token
     */
    async exchangeCode(code) {
        if (CLIENT_ID === 'mock_client_id') {
            // Mock mode for testing
            return { access_token: 'mock_access_token', refresh_token: 'mock_discord_refresh' };
        }

        const params = new URLSearchParams();
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI);

        try {
            const response = await axios.post('https://discord.com/api/oauth2/token', params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            return response.data;
        } catch (err) {
            logger.error('[DashboardOAuth] Failed to exchange code:', err.response?.data || err.message);
            throw new Error('OAUTH_EXCHANGE_FAILED');
        }
    }

    /**
     * Fetches user identity from Discord
     */
    async fetchUserIdentity(accessToken) {
        if (CLIENT_ID === 'mock_client_id') {
            return { id: 'mock_user_123', username: 'MockUser', avatar: 'mock_avatar_hash' };
        }

        try {
            const response = await axios.get('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            return response.data;
        } catch (err) {
            logger.error('[DashboardOAuth] Failed to fetch user:', err.response?.data || err.message);
            throw new Error('OAUTH_FETCH_USER_FAILED');
        }
    }

    /**
     * Creates an internal JWT session token
     * @param {Object} discordUser 
     * @param {string} role 'MASTER', 'ADMIN', 'MODERATOR', or 'READ_ONLY'
     */
    createSessionToken(discordUser, role = 'READ_ONLY') {
        const payload = {
            sub: discordUser.id,
            username: discordUser.username,
            avatar: discordUser.avatar,
            role: role,
            permissions: ['*'] // Simplified for now
        };

        return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    }
}

module.exports = new DashboardOAuthManager();
