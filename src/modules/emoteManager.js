const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const TwitchEmoteService = require('../services/twitch-emote.service');
const SevenTVService = require('../services/seven-tv.service');
const BTTVService = require('../services/bttv.service');
const FFZService = require('../services/ffz.service');

/**
 * Manages emote fetching, caching, and validation
 * Supports Twitch, 7TV, BTTV, and FFZ emotes, both channel-specific and global
 */
class EmoteManager {
    /**
     * Initialize the EmoteManager with default settings and services
     * @constructor
     */
    constructor() {
        this.emotes = new Map();
        this.lastUpdate = 0;
        this.services = {
            twitch: new TwitchEmoteService(config),
            sevenTv: new SevenTVService(config),
            bttv: new BTTVService(config),
            ffz: new FFZService(config)
        };
        this.cacheFile = config.files.emotesCache;
        this.refreshInterval = config.intervals.emoteRefresh || 1800000; // 30 minutes default
    }

    /**
     * Loads cached emotes from disk
     * If the cache is invalid or doesn't exist, initializes a new empty cache
     * @returns {Promise<void>}
     * @throws {Error} If there's an unhandled error reading the cache
     */
    async loadCache() {
        try {
            await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
            const data = await fs.readFile(this.cacheFile, 'utf-8');
            const cache = JSON.parse(data);
            
            if (this.isValidCache(cache)) {
                this.emotes = new Map(Object.entries(cache.emotes));
                this.lastUpdate = cache.lastUpdate;
                logger.success('Emote cache loaded successfully');
            } else {
                logger.warn('Invalid cache format, creating new cache');
                this.emotes.clear();
                this.lastUpdate = 0;
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.info('No existing cache found, will create new cache');
            } else {
                logger.error('Failed to load emote cache:', error);
            }
        }
    }

    /**
     * Persists the current emote cache to disk using atomic write operations
     * Creates a temporary file first, then renames it to ensure data integrity
     * @returns {Promise<void>}
     * @throws {Error} If the cache cannot be saved
     */
    async saveCache() {
        const tempFile = `${this.cacheFile}.tmp`;
        try {
            await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
            const cache = {
                emotes: Object.fromEntries(this.emotes),
                lastUpdate: this.lastUpdate,
                version: '1.0'
            };

            // Write to temporary file first
            await fs.writeFile(tempFile, JSON.stringify(cache, null, 2));
            // Atomic rename
            await fs.rename(tempFile, this.cacheFile);
            logger.success('Emote cache saved successfully');
        } catch (error) {
            logger.error('Failed to save emote cache:', error);
            // Clean up temp file if it exists
            try {
                await fs.unlink(tempFile);
            } catch (e) {
                // Ignore cleanup errors
            }
            throw error;
        }
    }

    /**
     * Updates the emote cache by fetching fresh data from all configured services
     * Only refreshes if the refresh interval has elapsed since last update
     * @param {string} channelId - Twitch channel ID to fetch emotes for
     * @param {string} channelName - Twitch channel name (used as fallback for ID resolution)
     * @returns {Promise<void>}
     * @throws {Error} If emote refresh fails or channel ID cannot be resolved
     */
    async refreshEmotes(channelId, channelName) {
        if (!this.shouldRefresh()) {
            logger.debug('Skipping emote refresh - within refresh interval');
            return;
        }

        try {
            const resolvedChannelId = await this.resolveChannelId(channelId, channelName);
            if (!resolvedChannelId) {
                throw new Error('Could not resolve channel ID');
            }

            const emotes = await this.fetchEmotesFromAllSources(resolvedChannelId, channelName);
            await this.updateEmoteCache(emotes);
            
            this.logEmoteStats(emotes);
        } catch (error) {
            logger.error('Failed to refresh emotes:', error);
            throw error; // Re-throw to allow caller to handle
        }
    }

    /**
     * Checks if a given word is a valid emote in the current cache
     * Considers platform enablement status from config
     * @param {string} word - The potential emote code to check
     * @returns {boolean} True if the word is a valid and enabled emote
     */
    isEmote(word) {
        const emote = this.emotes.get(word);
        return Boolean(emote && config.enabledPlatforms[emote.platform]);
    }

    /**
     * Retrieves detailed information about an emote
     * @param {string} word - The emote code to look up
     * @returns {Object|null} Emote metadata object if found and enabled, null otherwise
     */
    getEmoteInfo(word) {
        const emote = this.emotes.get(word);
        return emote && config.enabledPlatforms[emote.platform] ? emote : null;
    }

    /**
     * Resolves a Twitch username to its corresponding user ID
     * @param {string} username - Twitch username to resolve
     * @returns {Promise<string|null>} User ID if found, null otherwise
     */
    async getTwitchUserId(username) {
        return await this.services.twitch.getUserId(username);
    }

    // Private methods

    /**
     * Validates the structure and content of a loaded cache object
     * @private
     * @param {Object} cache - The cache object to validate
     * @returns {boolean} True if the cache is valid
     */
    isValidCache(cache) {
        return cache 
            && typeof cache.emotes === 'object'
            && typeof cache.lastUpdate === 'number';
    }

    /**
     * Determines if enough time has passed to warrant an emote refresh
     * @private
     * @returns {boolean} True if refresh interval has elapsed
     */
    shouldRefresh() {
        return Date.now() - this.lastUpdate >= this.refreshInterval;
    }

    /**
     * Resolves channel ID using provided ID, name, or config
     * @private
     * @param {string} channelId - Primary channel ID
     * @param {string} channelName - Fallback channel name
     * @returns {Promise<string|null>} Resolved channel ID or null
     */
    async resolveChannelId(channelId, channelName) {
        return config.channelTwitchId || 
               channelId || 
               await this.services.twitch.getUserId(channelName);
    }

    /**
     * Fetches emotes from all configured services (Twitch, 7TV, BTTV, and FFZ)
     * @private
     * @param {string} channelId - Channel ID to fetch emotes for
     * @param {string} channelName - Channel name for 7TV API
     * @returns {Promise<Array>} Combined array of all fetched emotes
     */
    async fetchEmotesFromAllSources(channelId, channelName) {
        const [
            twitchEmotes,
            globalTwitchEmotes,
            sevenTvEmotes,
            sevenTvGlobalEmotes,
            bttvEmotes,
            bttvGlobalEmotes,
            ffzEmotes,
            ffzGlobalEmotes,
        ] = await Promise.all([
            this.services.twitch.getChannelEmotes(channelId),
            this.services.twitch.getGlobalEmotes(),
            this.services.sevenTv.getChannelEmotes(channelId, channelName),
            this.services.sevenTv.getGlobalEmotes(),
            this.services.bttv.getChannelEmotes(channelId),
            this.services.bttv.getGlobalEmotes(),
            this.services.ffz.getChannelEmotes(channelId),
            this.services.ffz.getGlobalEmotes(),
        ]);

        return [
            ...twitchEmotes,
            ...globalTwitchEmotes,
            ...sevenTvEmotes,
            ...sevenTvGlobalEmotes,
            ...bttvEmotes,
            ...bttvGlobalEmotes,
            ...ffzEmotes,
            ...ffzGlobalEmotes,
        ].filter(emote => emote && emote.code);
    }

    /**
     * Updates the in-memory emote cache and persists to disk
     * @private
     * @param {Array} emotes - Array of emote objects to cache
     * @returns {Promise<void>}
     */
    async updateEmoteCache(emotes) {
        this.emotes.clear();
        emotes.forEach(emote => {
            this.emotes.set(emote.code, emote);
        });

        this.lastUpdate = Date.now();
        await this.saveCache();
    }

    /**
     * Logs statistics about fetched emotes by platform
     * @private
     * @param {Array} allEmotes - Array of all fetched emotes
     */
    logEmoteStats(allEmotes) {
        const stats = allEmotes.reduce((acc, emote) => {
            acc[emote.platform] = (acc[emote.platform] || 0) + 1;
            return acc;
        }, {});

        logger.info('\nEmote Statistics:');
        Object.entries(stats).forEach(([platform, count]) => {
            logger.info(`${platform}: ${count} emotes`);
        });
        logger.info(`Total unique emotes: ${this.emotes.size}\n`);
    }
}

// Export a singleton instance
module.exports = new EmoteManager();
