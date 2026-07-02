const { Collection } = require('discord.js');
const logger = require('../../../utils/logger');

class SessionManager {
    constructor() {
        /**
         * Cache format:
         * Key: `${guildId}:${channelId}:${messageId}:${userId}`
         * Value: {
         *    panelId: string,
         *    pageId: string,
         *    history: Array<{panelId, pageId}>,
         *    data: object,
         *    timeout: NodeJS.Timeout
         * }
         */
        this.sessions = new Collection();
        this.SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    }

    /**
     * Generates a unique session key.
     */
    _getKey(guildId, channelId, userId) {
        return `${guildId}:${channelId}:${userId}`;
    }

    /**
     * Creates or updates a session for a user.
     */
    setSession(guildId, channelId, userId, panelId, pageId = 'index', data = {}) {
        const key = this._getKey(guildId, channelId, userId);
        
        let session = this.sessions.get(key);
        if (session) {
            clearTimeout(session.timeout);
        } else {
            session = { history: [], data: {} };
        }

        session.panelId = panelId;
        session.pageId = pageId;
        session.data = { ...session.data, ...data };
        
        session.timeout = setTimeout(() => {
            this.destroySession(guildId, channelId, userId);
            logger.debug(`[UI SessionManager] Session expired for key: ${key}`);
        }, this.SESSION_TIMEOUT);

        this.sessions.set(key, session);
        return session;
    }

    /**
     * Gets an active session.
     */
    getSession(guildId, channelId, userId) {
        const key = this._getKey(guildId, channelId, userId);
        return this.sessions.get(key);
    }

    /**
     * Pushes current state to history and updates to new state.
     */
    navigate(guildId, channelId, userId, newPanelId, newPageId = 'index') {
        const session = this.getSession(guildId, channelId, userId);
        if (!session) return null;

        session.history.push({ panelId: session.panelId, pageId: session.pageId });
        return this.setSession(guildId, channelId, userId, newPanelId, newPageId, session.data);
    }

    /**
     * Pops history to go back.
     */
    goBack(guildId, channelId, userId) {
        const session = this.getSession(guildId, channelId, userId);
        if (!session || session.history.length === 0) return null;

        const previousState = session.history.pop();
        
        // Update session without adding to history again
        const key = this._getKey(guildId, channelId, userId);
        clearTimeout(session.timeout);
        
        session.panelId = previousState.panelId;
        session.pageId = previousState.pageId;
        
        session.timeout = setTimeout(() => {
            this.destroySession(guildId, channelId, userId);
        }, this.SESSION_TIMEOUT);

        this.sessions.set(key, session);
        return session;
    }

    /**
     * Destroys a session explicitly.
     */
    destroySession(guildId, channelId, userId) {
        const key = this._getKey(guildId, channelId, userId);
        const session = this.sessions.get(key);
        if (session) {
            clearTimeout(session.timeout);
            this.sessions.delete(key);
        }
    }
}

module.exports = new SessionManager();
