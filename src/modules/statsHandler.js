const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const AIHelper = require('../utils/ai-helper');

/**
 * Handles user statistics, emote tracking, and milestone management
 * @class StatsHandler
 */
class StatsHandler {
    /**
     * Creates a new StatsHandler instance
     * @param {Object} bot - The main bot instance
     */
    constructor(bot) {
        this.bot = bot;
        this.userStats = null;  // Change to null initially
        this.lastSaveTime = Date.now();
        this.saveQueue = Promise.resolve();
        this.metrics = {
            messagesProcessed: 0,
            emotesDetected: 0,
            commandsExecuted: 0,
            lastSaveAttempt: Date.now(),
            totalSaves: 0,
            failedSaves: 0
        };
        this.isLoaded = false;
        this.milestones = bot.config.milestones.values;
        this.milestoneMessages = bot.config.milestones.messages;
        this.aiHelper = new AIHelper(bot.config);
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute
    }

    /**
     * Retrieves a cached value or generates and caches a new one
     * @param {string} key - Cache key
     * @param {Function} getter - Function to generate value if not cached
     * @returns {*} Cached or newly generated value
     */
    getCached(key, getter) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.value;
        }
        
        const value = getter();
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
        return value;
    }

    /**
     * Ensures statistics are loaded before operations
     */
    async ensureLoaded() {
        if (!this.isLoaded) {
            await this.loadStats();
        }
    }

    /**
     * Loads user statistics from disk
     */
    async loadStats() {
        try {
            const data = await fs.readFile(this.bot.config.files.database, 'utf-8');
            const parsedData = JSON.parse(data);
            
            if (parsedData.stats) {
                this.userStats = parsedData.stats;
                if (parsedData.metrics) {
                    this.metrics = { ...this.metrics, ...parsedData.metrics };
                }
            } else {
                this.userStats = parsedData;
            }
            
            this.isLoaded = true;
            console.log(chalk.green('✓ Statistics loaded successfully'));
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(path.dirname(this.bot.config.files.database), { recursive: true });
                console.log(chalk.yellow('⚠ Created data directory'));
                this.userStats = {};
                this.isLoaded = true;
            } else {
                console.error(chalk.red('✗ Error loading statistics:'), error);
            }
        }
    }

    /**
     * Saves current statistics to disk using atomic write operations
     */
    async saveStats() {
        // Queue the save operation
        this.saveQueue = this.saveQueue.then(async () => {
            const tempFile = `${this.bot.config.files.database}.tmp`;
            try {
                await fs.mkdir(path.dirname(this.bot.config.files.database), { recursive: true });
                const saveData = {
                    stats: this.userStats,
                    metrics: this.metrics,
                    lastUpdate: Date.now()
                };
                await fs.writeFile(tempFile, JSON.stringify(saveData, null, 2));
                await fs.rename(tempFile, this.bot.config.files.database);
                this.lastSaveTime = Date.now();
                console.log(chalk.green(`✓ Statistics saved at ${chalk.blue(new Date().toISOString())}`));
            } catch (error) {
                try {
                    await fs.unlink(tempFile);
                } catch (e) {
                    // Ignore error if temp file doesn't exist
                }
                console.error(chalk.red('✗ Error saving statistics:'), error);
                throw error;
            }
        });
        return this.saveQueue;
    }

    /**
     * Clears statistics from memory to free up resources
     */
    async freeMemory() {
        if (!this.saveQueue.isPending()) {
            this.userStats = null;
            this.isLoaded = false;
            console.debug(chalk.green('✓ Statistics unloaded from memory'));
        }
    }

    /**
     * Increments user statistics and checks for milestones
     * @param {string} username - User to update
     * @param {string} emote - Emote used (optional)
     * @param {string} platform - Platform source (optional)
     * @param {boolean} totalOnly - Only increment total count
     * @returns {Object} Updated stats and reached milestones
     */
    async incrementStats(username, emote = null, platform = null, totalOnly = false) {
        await this.ensureLoaded();
        if (!username) {
            console.log(chalk.yellow('⚠ Missing username for stats increment'));
            return;
        }

        const prevTotal = this.userStats[username]?.total || 0;

        if (!this.userStats[username]) {
            this.userStats[username] = {
                total: 0,
                emotes: {},
                platforms: {},
                firstSeen: Date.now(),
                lastSeen: Date.now()
            };
        }
        
        // Increment total only if totalOnly is true or if we have emote info
        if (totalOnly || (emote && platform)) {
            this.userStats[username].total++;
        }

        // Update emote and platform counts only if provided
        if (emote && platform) {
            this.userStats[username].emotes[emote] = (this.userStats[username].emotes[emote] || 0) + 1;
            this.userStats[username].platforms[platform] = (this.userStats[username].platforms[platform] || 0) + 1;
        }
        
        this.userStats[username].lastSeen = Date.now();

        // Check for milestones
        const newTotal = this.userStats[username].total;
        const milestones = await this.checkMilestone(prevTotal, newTotal, username);
        
        // Update top user file only if this user might be the top user
        const currentTop = Object.entries(this.userStats)
            .sort((a, b) => b[1].total - a[1].total)[0];
        
        if (currentTop && currentTop[0] === username) {
            await this.saveTopUserFile(currentTop);
        }

        return { milestones, stats: this.userStats[username] };
    }

    /**
     * Checks if user has reached any milestones
     * @param {number} prevTotal - Previous total count
     * @param {number} newTotal - New total count
     * @param {string} username - User to check
     * @returns {Array|null} Array of reached milestones or null
     */
    async checkMilestone(prevTotal, newTotal, username) {
        const reachedMilestones = [];
        
        for (const milestone of this.milestones) {
            if (prevTotal < milestone && newTotal >= milestone) {
                let message = this.milestoneMessages[milestone];
                
                if (this.bot.config.features.enableAiMessages) {
                    try {
                        const aiMessage = await this.aiHelper.generateMilestoneMessage(username, milestone);
                        if (aiMessage) {
                            message = aiMessage;
                        }
                    } catch (error) {
                        console.error(chalk.red('Error getting AI milestone message:'), error);
                        // Fall back to default message
                    }
                }

                reachedMilestones.push({
                    count: milestone,
                    message: message.replace('{count}', milestone.toLocaleString())
                });
            }
        }
        
        return reachedMilestones.length > 0 ? reachedMilestones : null;
    }

    /**
     * Updates the top user file with current leader's stats
     * @param {Array|Object} userdata - User data to save
     */
    async saveTopUserFile(userdata) {
        try {
            // Skip if no userdata provided
            if (!userdata) {
                return;
            }

            let username, stats;
            
            if (Array.isArray(userdata)) {
                [username, stats] = userdata;
            } else {
                username = userdata.username;
                stats = {
                    total: userdata.total,
                    emotes: userdata.emotes || {}
                };
            }

            // Additional validation
            if (!username || !stats || typeof stats.total === 'undefined') {
                console.debug(chalk.yellow('⚠ Invalid user data structure:'), { username, stats });
                return;
            }

            const favoriteEmote = this.getMostUsedEmote(stats.emotes || {});
            const format = this.bot.config.format.topUser
                .replace('{username}', username)
                .replace('{total}', stats.total)
                .replace('{rank}', '1')
                .replace('{favorite_emote}', favoriteEmote);

            await fs.writeFile(this.bot.config.files.topUser, format);
            console.debug(chalk.green(`✓ Updated top user file for ${chalk.blue(username)}`));
        } catch (error) {
            console.error(chalk.red('✗ Error saving top user file:'), error);
        }
    }

    /**
     * Gets the most frequently used emote from stats
     * @param {Object} emotes - Emote usage counts
     * @returns {string} Most used emote or 'none'
     */
    getMostUsedEmote(emotes) {
        if (!emotes || typeof emotes !== 'object') {
            return 'none';
        }
        const entries = Object.entries(emotes);
        return entries.length > 0 ? entries.sort((a, b) => b[1] - a[1])[0][0] : 'none';
    }

    /**
     * Gets total usage count for specific emote
     * @param {string} emoteName - Emote to check
     * @returns {number} Total usage count
     */
    async getEmoteUsageCount(emoteName) {
        await this.ensureLoaded();
        return Object.values(this.userStats).reduce((total, user) => {
            return total + (user.emotes[emoteName] || 0);
        }, 0);
    }

    /**
     * Gets user's rank among all users
     * @param {string} username - User to check
     * @returns {Object|null} Rank position and total count
     */
    async getUserRank(username) {
        await this.ensureLoaded();
        const sortedUsers = Object.entries(this.userStats)
            .sort((a, b) => b[1].total - a[1].total);
        
        const position = sortedUsers.findIndex(([name]) => name.toLowerCase() === username.toLowerCase()) + 1;
        if (position === 0) return null;
        
        return {
            position,
            total: this.userStats[username].total
        };
    }

    /**
     * Gets aggregated stats per platform
     * @returns {Object} Platform usage counts
     */
    async getPlatformStats() {
        await this.ensureLoaded();
        return Object.values(this.userStats).reduce((platforms, user) => {
            Object.entries(user.platforms).forEach(([platform, count]) => {
                platforms[platform] = (platforms[platform] || 0) + count;
            });
            return platforms;
        }, {});
    }

    /**
     * Resets all statistics
     */
    async resetStats() {
        this.userStats = {};
        this.metrics = {
            messagesProcessed: 0,
            emotesDetected: 0,
            commandsExecuted: 0,
            lastSaveAttempt: Date.now(),
            totalSaves: 0,
            failedSaves: 0
        };
        await this.saveStats();
    }

    /**
     * Gets statistics for specific user
     * @param {string} username - User to lookup
     * @returns {Object} User's statistics
     */
    async getUserStats(username) {
        await this.ensureLoaded();
        return this.userStats[username];
    }

    /**
     * Displays and exports top 10 users
     */
    async displayTopUsers() {
        await this.ensureLoaded();
        const sortedUsers = Object.entries(this.userStats)
            .filter(([username, stats]) => stats && typeof stats.total === 'number')
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 10);

        if (sortedUsers.length > 0) {
            // Pass array directly instead of object
            await this.saveTopUserFile(sortedUsers[0]);
        }

        console.log(chalk.cyan('\n📊 Top 10 Usuários:'));
        sortedUsers.forEach(([username, stats], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ' ';
            console.log(chalk.yellow(`${medal} ${index + 1}. ${chalk.bold(username)} - Total: ${chalk.green(stats.total)}`));
        });

        const topUsersData = sortedUsers.map(([username, stats]) => ({
            username,
            total: stats.total,
            emotes: stats.emotes
        }));
        
        await fs.writeFile(this.bot.config.files.export, JSON.stringify(topUsersData, null, 2));
        console.log(chalk.green(`✓ Top 10 usuários exportados para ${chalk.blue(this.bot.config.files.export)}`));
    }

    /**
     * Increments emote usage count for user
     * @param {string} username - User who used emote
     * @param {string} emote - Emote used
     * @param {string} platform - Platform source
     */
    async incrementEmoteCount(username, emote, platform) {
        await this.ensureLoaded();
        if (!username || !emote || !platform) {
            console.log(chalk.yellow('⚠ Missing required data for emote increment'));
            return;
        }

        if (!this.userStats[username]) {
            this.userStats[username] = {
                total: 0,
                emotes: {},
                platforms: {},
                firstSeen: Date.now(),
                lastSeen: Date.now()
            };
        }

        this.userStats[username].emotes[emote] = (this.userStats[username].emotes[emote] || 0) + 1;
        this.userStats[username].platforms[platform] = (this.userStats[username].platforms[platform] || 0) + 1;
        this.userStats[username].lastSeen = Date.now();
    }
}

module.exports = StatsHandler;
