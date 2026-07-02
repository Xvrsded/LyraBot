/**
 * dashboardRoutes.js — Express router for the dashboard backend (Module 19)
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const dashboardOAuthManager = require('./managers/dashboardOAuthManager');
const dashboardSessionManager = require('./managers/dashboardSessionManager');
const dashboardWidgetRegistry = require('./managers/dashboardWidgetRegistry');
const dashboardPreferences = require('./managers/dashboardPreferences');
const dashboardNotificationCenter = require('./managers/dashboardNotificationCenter');
const dashboardUploadService = require('./managers/dashboardUploadService');
const dashboardStatistics = require('./managers/dashboardStatistics');

const apiResponse = require('../api/formatters/apiResponse');

const router = express.Router();
router.use(cookieParser());

// Static route for uploads
router.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ── Authentication ────────────────────────────────────────────────────────
router.get('/auth/discord', (req, res) => {
    res.redirect(dashboardOAuthManager.getLoginUrl());
});

router.get('/auth/discord/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).json(apiResponse.error('MISSING_CODE', 'Authorization code is missing'));

        const tokenData = await dashboardOAuthManager.exchangeCode(code);
        const discordUser = await dashboardOAuthManager.fetchUserIdentity(tokenData.access_token);
        
        // In a real app, query database to find user role. For now, we assume MASTER if mock, else READ_ONLY.
        const role = (discordUser.id === 'mock_user_123') ? 'MASTER' : 'READ_ONLY';
        const jwtToken = dashboardOAuthManager.createSessionToken(discordUser, role);
        
        const session = await dashboardSessionManager.createSession(discordUser.id, req);
        dashboardStatistics.recordLogin();

        // Set secure cookies
        res.cookie('dashboard_session', session.sessionId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 3600000 });
        res.cookie('dashboard_refresh', session.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 3600000 });
        
        // Return JWT for React app to store in memory
        res.json(apiResponse.success({ jwt: jwtToken, user: discordUser }));
    } catch (err) {
        res.status(500).json(apiResponse.error('AUTH_FAILED', err.message));
    }
});

router.post('/auth/refresh', async (req, res) => {
    try {
        const sessionId = req.cookies.dashboard_session;
        const refreshToken = req.cookies.dashboard_refresh;
        
        if (!sessionId || !refreshToken) throw new Error('NO_SESSION');
        
        const userId = await dashboardSessionManager.refreshSession(sessionId, refreshToken);
        
        // We'd typically fetch user from DB here.
        const jwtToken = dashboardOAuthManager.createSessionToken({ id: userId, username: 'User' }, 'READ_ONLY');
        res.json(apiResponse.success({ jwt: jwtToken }));
    } catch (err) {
        res.status(401).json(apiResponse.error('REFRESH_FAILED', err.message));
    }
});

router.post('/auth/logout', async (req, res) => {
    const sessionId = req.cookies.dashboard_session;
    if (sessionId) await dashboardSessionManager.revokeSession(sessionId);
    res.clearCookie('dashboard_session');
    res.clearCookie('dashboard_refresh');
    res.json(apiResponse.success({ loggedOut: true }));
});

// ── Middleware to require JWT for protected routes ─────────────────────────
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json(apiResponse.error('UNAUTHORIZED', 'Missing JWT token'));
    }
    const token = authHeader.slice(7);
    try {
        const payload = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production');
        req.user = payload;
        next();
    } catch (err) {
        res.status(401).json(apiResponse.error('INVALID_TOKEN', 'Token is invalid or expired'));
    }
};

// ── Registry ──────────────────────────────────────────────────────────────
router.get('/registry/widgets', requireAuth, (req, res) => {
    res.json(apiResponse.success(dashboardWidgetRegistry.getAllWidgets()));
});

router.get('/registry/pages', requireAuth, (req, res) => {
    res.json(apiResponse.success(dashboardWidgetRegistry.getAllPages()));
});

// ── Preferences ───────────────────────────────────────────────────────────
router.get('/preferences', requireAuth, async (req, res) => {
    const prefs = await dashboardPreferences.getPreferences(req.user.sub);
    res.json(apiResponse.success(prefs));
});

router.put('/preferences', requireAuth, async (req, res) => {
    const prefs = await dashboardPreferences.updatePreferences(req.user.sub, req.body);
    res.json(apiResponse.success(prefs));
});

// ── Notifications ─────────────────────────────────────────────────────────
router.get('/notifications', requireAuth, async (req, res) => {
    const notifs = await dashboardNotificationCenter.getUnread(req.user.sub);
    res.json(apiResponse.success(notifs));
});

router.post('/notifications/:id/read', requireAuth, async (req, res) => {
    await dashboardNotificationCenter.markAsRead(req.user.sub, req.params.id);
    res.json(apiResponse.success({ marked: true }));
});

// ── Uploads ───────────────────────────────────────────────────────────────
router.post('/upload', requireAuth, dashboardUploadService.getMiddleware('file'), (req, res) => {
    if (!req.file) return res.status(400).json(apiResponse.error('UPLOAD_FAILED', 'No file provided'));
    const url = dashboardUploadService.getFileUrl(req.file.filename);
    res.json(apiResponse.success({ url }));
});

// ── Stats ─────────────────────────────────────────────────────────────────
router.get('/stats', requireAuth, async (req, res) => {
    if (req.user.role !== 'MASTER') return res.status(403).json(apiResponse.error('FORBIDDEN', 'Master only'));
    const stats = await dashboardStatistics.getStats();
    res.json(apiResponse.success(stats));
});

module.exports = router;
