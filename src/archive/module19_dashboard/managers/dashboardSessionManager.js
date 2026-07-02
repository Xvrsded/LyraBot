/**
 * dashboardSessionManager.js — Manages active dashboard sessions and long-lived refresh tokens.
 */

const crypto = require('crypto');
const DashboardSession = require('../../models/DashboardSession');
const logger = require('../../utils/logger');

class DashboardSessionManager {
    /**
     * Creates a new long-lived session for "Remember Me" functionality.
     */
    async createSession(userId, req) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        try {
            const session = new DashboardSession({
                userId,
                sessionId,
                refreshToken,
                expiresAt,
                userAgent: req.headers['user-agent'] || 'unknown',
                ipAddress: req.ip || 'unknown'
            });

            await session.save();
            return { sessionId, refreshToken, expiresAt };
        } catch (err) {
            logger.error('[DashboardSession] Error creating session:', err.message);
            throw err;
        }
    }

    /**
     * Validates a refresh token and extends the session if valid.
     */
    async refreshSession(sessionId, refreshToken) {
        try {
            const session = await DashboardSession.findOne({ sessionId, refreshToken });
            if (!session) throw new Error('INVALID_SESSION');
            if (session.expiresAt < new Date()) {
                await this.revokeSession(sessionId);
                throw new Error('SESSION_EXPIRED');
            }

            // Extend session by another 30 days
            session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await session.save();
            
            return session.userId;
        } catch (err) {
            logger.error('[DashboardSession] Error refreshing session:', err.message);
            throw err;
        }
    }

    /**
     * Revokes a specific session (Logout).
     */
    async revokeSession(sessionId) {
        try {
            await DashboardSession.deleteOne({ sessionId });
        } catch (err) {
            logger.error('[DashboardSession] Error revoking session:', err.message);
        }
    }

    /**
     * Gets all active sessions for a user.
     */
    async getUserSessions(userId) {
        try {
            return await DashboardSession.find({ userId }).select('-refreshToken');
        } catch (err) {
            logger.error('[DashboardSession] Error fetching user sessions:', err.message);
            return [];
        }
    }
}

module.exports = new DashboardSessionManager();
