const colors = {
    reset: "\x1b[0m",
    info: "\x1b[36m", // Cyan
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    debug: "\x1b[90m" // Gray
};

class Logger {
    constructor() {
        this.client = null;
        this.logChannelId = '1535538710639018026';
    }

    setClient(client) {
        this.client = client;
    }

    async sendToDiscord(level, message, ...args) {
        if (!this.client || !this.logChannelId) return;
        try {
            const channel = this.client.channels.cache.get(this.logChannelId);
            if (channel) {
                const util = require('util');
                const formattedArgs = args.length > 0 ? ' ' + args.map(a => typeof a === 'string' ? a : util.inspect(a)).join(' ') : '';
                let fullMessage = message + formattedArgs;
                const safeMsg = fullMessage.length > 1900 ? fullMessage.substring(0, 1900) + '...' : fullMessage;
                const emoji = level === 'ERROR' ? '🔴' : level === 'WARN' ? '🟡' : level === 'INFO' ? '🟢' : '⚪';
                await channel.send(`${emoji} **[${level}]** \`${safeMsg}\``).catch(() => {});
            }
        } catch (e) {
            // Abaikan error saat mengirim log
        }
    }

    /**
     * Log informational message.
     * @param {string} message 
     * @param {...any} args 
     */
    info(message, ...args) {
        console.log(`${colors.info}[INFO] [${new Date().toISOString()}] ${message}${colors.reset}`, ...args);
        this.sendToDiscord('INFO', message, ...args);
    }

    /**
     * Log warnings.
     * @param {string} message 
     * @param {...any} args 
     */
    warn(message, ...args) {
        console.warn(`${colors.warn}[WARN] [${new Date().toISOString()}] ${message}${colors.reset}`, ...args);
        this.sendToDiscord('WARN', message, ...args);
    }

    /**
     * Log errors.
     * @param {string} message 
     * @param {...any} args 
     */
    error(message, ...args) {
        console.error(`${colors.error}[ERROR] [${new Date().toISOString()}] ${message}${colors.reset}`, ...args);
        this.sendToDiscord('ERROR', message, ...args);
    }

    /**
     * Log debug message.
     * @param {string} message 
     * @param {...any} args 
     */
    debug(message, ...args) {
        console.log(`${colors.debug}[DEBUG] [${new Date().toISOString()}] ${message}${colors.reset}`, ...args);
    }
}

module.exports = new Logger();
