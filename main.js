const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const logger = require('./src/utils/logger');
const App = require('./src/app');
const CommandHandler = require('./src/modules/commandHandler');
const StatsHandler = require('./src/modules/statsHandler');
const EmoteProcessor = require('./src/modules/emoteProcessor');
const config = require('./src/config');
const readline = require('readline');

/**
 * Manages reconnection attempts with exponential backoff
 */
class ReconnectionManager {
    constructor(maxAttempts = 5, baseDelay = 5000) {
        this.attempts = 0;
        this.maxAttempts = maxAttempts;
        this.baseDelay = baseDelay;
    }

    async handleReconnect(callback) {
        if (this.attempts >= this.maxAttempts) {
            throw new Error('Max reconnection attempts reached');
        }

        const delay = this.baseDelay * Math.pow(2, this.attempts);
        this.attempts++;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return callback();
    }

    reset() {
        this.attempts = 0;
    }
}

/**
 * Main ChatBot class that handles Twitch chat interactions and message processing
 */
class ChatBot {
    constructor() {
        this.initializeProperties();
        this.initializeHandlers();
        this.setupPeriodicTasks();
    }

    /**
     * Initialize basic properties
     * @private
     */
    initializeProperties() {
        this.config = config;
        this.isShuttingDown = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.lastActivityTime = Date.now();
    }

    /**
     * Initialize handlers and processors
     * @private
     */
    initializeHandlers() {
        this.statsHandler = new StatsHandler(this);
        this.commandHandler = new CommandHandler(this);
        this.emoteProcessor = new EmoteProcessor(this);
        this.app = new App(this);

        // Initialize the debounced save function
        this.debouncedSave = this.debounce(() => {
            this.statsHandler.saveStats().catch(error => {
                logger.error('Error during auto-save:', error);
            });
        }, 5000);
    }

    /**
     * Setup periodic tasks like auto-save and memory management
     * @private
     */
    setupPeriodicTasks() {
        this.setupAutoSave();
        this.setupMemoryManager();
    }

    /**
     * Creates a debounced function
     * @private
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Sets up automatic saving of statistics
     * @private
     */
    setupAutoSave() {
        const autoSaveInterval = config.intervals.autoSave || 300000; // 5 minutes default
        setInterval(() => {
            this.debouncedSave();
        }, autoSaveInterval);
    }

    /**
     * Triggers an auto-save operation
     */
    async triggerAutoSave() {
        this.statsHandler.metrics.lastSaveAttempt = Date.now();
        this.debouncedSave();
    }

    /**
     * Sets up memory management and cleanup
     * @private
     */
    setupMemoryManager() {
        const INACTIVE_THRESHOLD = 900000; // 15 minutes
        const CHECK_INTERVAL = 300000; // 5 minutes

        setInterval(async () => {
            const inactiveTime = Date.now() - this.lastActivityTime;
            if (inactiveTime > INACTIVE_THRESHOLD) {
                await this.statsHandler.freeMemory();
            }
        }, CHECK_INTERVAL);
    }

    /**
     * Handles incoming chat messages
     * @param {string} channel - Channel name
     * @param {Object} tags - Message tags
     * @param {string} message - Message content
     * @param {boolean} self - Whether message is from bot
     */
    async handleMessage(channel, tags, message, self) {
        if (self) return;
        
        this.lastActivityTime = Date.now();
        this.statsHandler.metrics.messagesProcessed++;
        
        const username = tags['display-name'] || tags.username;
        
        if (message.startsWith('!')) {
            await this.commandHandler.handleCommand(channel, username, message.slice(1));
            return;
        }

        this.emoteProcessor.processMessage(username, message);
    }

    /**
     * Initializes the bot and handles startup
     */
    async init() {
        try {
            if (await this.handleResetCommand()) {
                process.exit(0);
            }

            this.client = await this.app.setupTwitchClient();
            await this.app.initialize();
            this.app.setupShutdown();
        } catch (error) {
            logger.error('Fatal error during initialization:', error);
            process.exit(1);
        }
    }

    /**
     * Handles the reset command if present
     * @private
     * @returns {Promise<boolean>} Whether reset was performed
     */
    async handleResetCommand() {
        if (!argv.reset) return false;

        const confirmed = await confirmReset();
        if (confirmed) {
            logger.info('Resetting all statistics...');
            await this.statsHandler.resetStats();
            logger.info('Reset completed successfully.');
        } else {
            logger.info('Reset cancelled by user.');
        }
        return true;
    }
}

/**
 * Prompts for confirmation before resetting statistics
 * @returns {Promise<boolean>} User's confirmation
 */
async function confirmReset() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Are you sure you want to reset all statistics? This action cannot be undone. (y/N): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .option('reset', {
        alias: 'r',
        type: 'boolean',
        description: 'Reset all statistics'
    })
    .help()
    .argv;

// Start the bot
const bot = new ChatBot();
bot.init().catch(error => logger.error('Startup error:', error));
