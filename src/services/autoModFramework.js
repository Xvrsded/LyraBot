const logger = require('../utils/logger');

class AutoModFramework {
    constructor() {
        this.rules = new Map();

        // Register default placeholder rule checks
        this.registerRule('spam_detection', this.checkSpam.bind(this));
        this.registerRule('invite_detection', this.checkInvites.bind(this));
        this.registerRule('link_detection', this.checkLinks.bind(this));
        this.registerRule('mention_spam', this.checkMentionSpam.bind(this));
        this.registerRule('caps_spam', this.checkCapsSpam.bind(this));
        this.registerRule('bad_words', this.checkBadWords.bind(this));
        this.registerRule('repeated_messages', this.checkRepeatedMessages.bind(this));
    }

    /**
     * Registers a rule callback evaluator.
     * @param {string} ruleName Name identifier of the check
     * @param {function} checkFn Callback checking function
     */
    registerRule(ruleName, checkFn) {
        this.rules.set(ruleName, checkFn);
        logger.info(`[AutoModFramework] Registered check hook: "${ruleName}"`);
    }

    /**
     * Runs all registered AutoMod rules against an incoming message.
     * @param {Message} message Discord Message object
     * @returns {Promise<boolean>} True if message triggered a penalty, false otherwise
     */
    async processMessage(message) {
        if (!message || message.author.bot || !message.guild) return false;

        for (const [ruleName, check] of this.rules.entries()) {
            try {
                const triggered = await check(message);
                if (triggered) {
                    logger.warn(`[AutoModFramework] Message by ${message.author.tag} triggered rule "${ruleName}"`);
                    return true;
                }
            } catch (err) {
                logger.error(`[AutoModFramework] Error evaluating rule "${ruleName}":`, err.message);
            }
        }
        return false;
    }

    // --- Placeholders for future implementations ---

    async checkSpam(message) {
        // Future spam rate checks
        return false;
    }

    async checkInvites(message) {
        // Future discord invite links search
        return false;
    }

    async checkLinks(message) {
        // Future URLs regex filtering
        return false;
    }

    async checkMentionSpam(message) {
        // Future excessive user/role mention count checks
        return false;
    }

    async checkCapsSpam(message) {
        // Future capital letters threshold validation
        return false;
    }

    async checkBadWords(message) {
        // Future profanity blacklists matching
        return false;
    }

    async checkRepeatedMessages(message) {
        // Future duplicate content matching
        return false;
    }
}

module.exports = new AutoModFramework();
