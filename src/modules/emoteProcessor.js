const chalk = require('chalk');
const emoteManager = require('../modules/emoteManager');

/**
 * Handles the processing of chat messages to detect and track emote usage
 */
class EmoteProcessor {
    /**
     * Creates an instance of EmoteProcessor
     * @param {Object} bot - The main bot instance
     */
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Processes a chat message to detect and track emotes
     * @param {string} username - The username of the message sender
     * @param {string} message - The chat message content
     */
    async processMessage(username, message) {
        try {
            // Split message into words and filter for emotes
            const words = message.split(' ');
            const detectedEmotes = words.filter(word => emoteManager.isEmote(word));
            
            if (detectedEmotes.length > 0) {
                // Update user stats and get milestone information
                const { milestones, stats } = await this.bot.statsHandler.incrementStats(username, null, null, true);
                
                // Process each detected emote
                for (const emote of detectedEmotes) {
                    const emoteInfo = emoteManager.getEmoteInfo(emote);
                    await this.bot.statsHandler.incrementEmoteCount(username, emote, emoteInfo.platform);
                    this.bot.statsHandler.metrics.emotesDetected++;
                }

                // Log detection and handle milestones
                this.logEmoteDetections(username, detectedEmotes, stats);

                if (milestones) {
                    for (const milestone of milestones) {
                        await this.notifyMilestone(username, milestone);
                    }
                }
            }
        } catch (error) {
            console.error(chalk.red('Error processing message:'), error);
        }
    }

    /**
     * Logs detected emotes and their usage statistics
     * @param {string} username - The username of the message sender
     * @param {Array<string>} detectedEmotes - Array of detected emotes
     * @param {Object} stats - User's emote statistics
     */
    logEmoteDetections(username, detectedEmotes, stats) {
        // Count occurrences of each emote in the current message
        const emoteCounts = detectedEmotes.reduce((acc, emote) => {
            acc[emote] = (acc[emote] || 0) + 1;
            return acc;
        }, {});

        // Format emote details for logging
        const uniqueEmotes = [...new Set(detectedEmotes)];
        const emoteDetails = uniqueEmotes.map(emote => {
            const emoteInfo = emoteManager.getEmoteInfo(emote);
            const count = stats.emotes[emote];
            const timesInMessage = emoteCounts[emote];
            return `   ${emote} (${emoteInfo.platform}): ${count} total${timesInMessage > 1 ? ` [${timesInMessage}x in message]` : ''}`;
        }).join('\n');

        // Log formatted emote detection info
        console.log(
            chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n') +
            chalk.yellow(`🎯 Emotes detected from ${chalk.bold(username)}:\n`) +
            emoteDetails + '\n' +
            chalk.green(`   Total user score: ${chalk.white(stats.total)}`)
        );
    }

    /**
     * Sends milestone achievement notifications to chat
     * @param {string} username - The username who reached the milestone
     * @param {Object} milestone - Milestone information object
     */
    async notifyMilestone(username, milestone) {
        try {
            // Format and send milestone message
            const message = milestone.message
                ? `PogChamp @${username} ${milestone.message.replace('chegou a {count}', milestone.count.toLocaleString())}`
                : `PogChamp @${username} atingiu ${milestone.count.toLocaleString()} emotes! Parabéns! 🎉`;

            // Send notification to chat and log milestone
            await this.bot.client.say(this.bot.config.channel, message);
            console.log(chalk.magenta(`🏆 Milestone reached: ${username} - ${milestone.count} emotes`));
        } catch (error) {
            console.error(chalk.red('Error sending milestone notification:'), error);
        }
    }
}

module.exports = EmoteProcessor;
