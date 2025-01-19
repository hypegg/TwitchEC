const tmi = require('tmi.js');
const config = require('./config');
const logger = require('./utils/logger');
const emoteManager = require('./modules/emoteManager');

/**
 * Main application class that handles Twitch client setup and management
 * @class App
 */
class App {
    /**
     * Creates an instance of App
     * @param {Object} bot - The bot instance that handles message processing
     */
    constructor(bot) {
        this.bot = bot;
        this.client = null;
    }

    /**
     * Initializes and configures the Twitch client with connection settings
     * @returns {tmi.Client} Configured Twitch client instance
     */
    async setupTwitchClient() {
        this.client = new tmi.Client({
            options: { 
                debug: true,           // Enable debug logging
                reconnect: true,       // Auto reconnect on disconnect
                joinTimeout: 5000      // Channel join timeout in ms
            },
            connection: {
                reconnect: true,
                maxReconnectAttempts: this.bot.maxReconnectAttempts,
                reconnectInterval: 5000
            },
            identity: {
                username: config.username,
                password: config.token
            },
            channels: [config.channel]
        });

        this.setupEventHandlers();
        return this.client;
    }

    /**
     * Sets up event handlers for Twitch client events
     * @throws {Error} If client is not initialized
     */
    setupEventHandlers() {
        if (!this.client) {
            throw new Error('Client not initialized');
        }
        
        // Handle incoming chat messages
        this.client.on('message', this.bot.handleMessage.bind(this.bot));
        
        // Connection success handler
        this.client.on('connected', (address, port) => {
            logger.success(`Connected to ${address}:${port}`);
            logger.success(`Monitoring channel: ${config.channel}`);
            this.bot.statsHandler.loadStats();
        });

        // Disconnection handler with retry logic
        this.client.on('disconnected', (reason) => {
            if (!this.bot.isShuttingDown) {
                logger.error(`Disconnected: ${reason}`);
                if (this.bot.reconnectAttempts < this.bot.maxReconnectAttempts) {
                    this.bot.reconnectAttempts++;
                    logger.warn(`Reconnection attempt ${this.bot.reconnectAttempts}/${this.bot.maxReconnectAttempts}`);
                }
            }
        });

        // Reconnection attempt handler
        this.client.on('reconnect', () => {
            logger.warn('Reconnecting...');
        });
    }

    /**
     * Initializes the application by loading stats, connecting to Twitch,
     * and setting up channel-specific configurations
     * @throws {Error} If initialization fails
     */
    async initialize() {
        try {
            // Load previous statistics and emote cache
            await this.bot.statsHandler.loadStats();
            await emoteManager.loadCache();
            
            if (!this.client) {
                throw new Error('Twitch client not initialized');
            }

            await this.client.connect();

            // Get channel ID and refresh emotes
            const channelName = config.channel.toLowerCase();
            const channelId = await emoteManager.getTwitchUserId(channelName);
            
            if (!channelId) {
                logger.error('Could not get channel ID. Check your Twitch API credentials.');
                process.exit(1);
            }

            await emoteManager.refreshEmotes(channelId, channelName);
        } catch (error) {
            logger.error('Failed to initialize:', error);
            process.exit(1);
        }
    }

    /**
     * Sets up graceful shutdown handlers for various signals and errors
     */
    setupShutdown() {
        /**
         * Handles the shutdown process
         * @param {string} signal - The signal that triggered the shutdown
         */
        const shutdown = async (signal) => {
            if (this.bot.isShuttingDown) return;
            this.bot.isShuttingDown = true;
            
            logger.warn(`Received ${signal} signal, shutting down...`);
            try {
                await this.bot.statsHandler.displayTopUsers();
                await this.bot.statsHandler.saveStats();
                if (this.client) {
                    await this.client.disconnect();
                }
            } catch (error) {
                logger.error('Error during shutdown:', error);
            } finally {
                process.exit(0);
            }
        };

        // Register process event handlers
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('unhandledRejection', (error) => {
            logger.error('Unhandled promise rejection:', error);
        });
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            shutdown('UNCAUGHT_EXCEPTION');
        });
    }
}

module.exports = App;