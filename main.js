const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const logger = require('./src/utils/logger');
const App = require('./src/app');
const CommandHandler = require('./src/modules/commandHandler');
const StatsHandler = require('./src/modules/statsHandler');
const EmoteProcessor = require('./src/modules/emoteProcessor');
const config = require('./src/config');
const readline = require('readline');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .option('reset', {
        alias: 'r',
        type: 'boolean',
        description: 'Reset all statistics'
    })
    .help()
    .argv;

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

class ChatBot {
    constructor() {
        this.config = config;
        this.statsHandler = new StatsHandler(this);
        this.commandHandler = new CommandHandler(this);
        this.emoteProcessor = new EmoteProcessor(this);
        this.isShuttingDown = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.lastActivityTime = Date.now();
        
        this.app = new App(this);
        this.setupAutoSave();
        this.setupMemoryManager();
    }

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

    setupAutoSave() {
        setInterval(() => {
            this.debouncedSave();
        }, config.intervals.autoSave || 300000);
    }

    async triggerAutoSave() {
        const now = Date.now();
        this.statsHandler.metrics.lastSaveAttempt = now;
        this.debouncedSave();
    }

    setupMemoryManager() {
        // Check every 5 minutes if stats can be unloaded
        setInterval(async () => {
            const inactiveTime = Date.now() - this.lastActivityTime;
            // Unload stats if no activity for 15 minutes
            if (inactiveTime > 900000) {
                await this.statsHandler.freeMemory();
            }
        }, 300000);
    }

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

    async init() {
        try {
            // Handle reset command with confirmation
            if (argv.reset) {
                const confirmed = await confirmReset();
                if (confirmed) {
                    logger.info('Resetting all statistics...');
                    await this.statsHandler.resetStats();
                    logger.info('Reset completed successfully.');
                } else {
                    logger.info('Reset cancelled by user.');
                }
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
}

const bot = new ChatBot();
bot.init().catch(error => logger.error('Startup error:', error));
