const colors = {
    reset: "\x1b[0m",
    info: "\x1b[36m", // Cyan
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    debug: "\x1b[90m" // Gray
};

class Logger {
    /**
     * Log informational message.
     * @param {string} message 
     * @param {...any} args 
     */
    info(message, ...args) {
        console.log(`${colors.info}[INFO] [${new Date().toISOString()}] ${message}${colors.reset}`, ...args);
    }

    /**
     * Log warnings.
     * @param {string} message 
     * @param {...any} args 
     */
    warn(message, ...args) {
        console.warn(`${colors.warn}[WARN] [${new Date().toISOString()}] ${message}${colors.reset}`, ...args);
    }

    /**
     * Log errors.
     * @param {string} message 
     * @param {...any} args 
     */
    error(message, ...args) {
        console.error(`${colors.error}[ERROR] [${new Date().toISOString()}] ${message}${colors.reset}`, ...args);
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
