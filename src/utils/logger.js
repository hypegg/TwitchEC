const chalk = require('chalk');
const config = require('../config');

/**
 * Logger utility class for consistent console output formatting
 * Uses chalk for colored console output
 */
class Logger {
    constructor() {
        this.debugEnabled = config.features.enableLogging;
    }

    /**
     * Logs an info message in green
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    info(message, ...args) {
        console.log(chalk.green(`ℹ ${message}`), ...args);
    }

    /**
     * Logs an error message in red
     * @param {string} message - The error message
     * @param {Error} error - The error object
     */
    error(message, error) {
        console.error(chalk.red(`✗ ${message}`), error);
        // Could add error logging to file here if needed
    }

    /**
     * Logs a warning message in yellow
     * @param {string} message - The warning message
     * @param {...any} args - Additional arguments to log
     */
    warn(message, ...args) {
        console.log(chalk.yellow(`⚠ ${message}`), ...args);
    }

    /**
     * Logs a debug message in gray if debug is enabled
     * @param {string} message - The debug message
     * @param {...any} args - Additional arguments to log
     */
    debug(message, ...args) {
        if (this.debugEnabled) {
            console.debug(chalk.gray(`🔍 ${message}`), ...args);
        }
    }

    /**
     * Logs a success message in green
     * @param {string} message - The success message
     * @param {...any} args - Additional arguments to log
     */
    success(message, ...args) {
        console.log(chalk.green(`✓ ${message}`), ...args);
    }
}

module.exports = new Logger();