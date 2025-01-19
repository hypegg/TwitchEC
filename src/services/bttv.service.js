const axios = require('axios');
const { withRetry } = require('../utils/api-helpers');

/**
 * Service for interacting with the BTTV API to fetch emotes
 */
class BTTVService {
    /**
     * Creates a new BTTVService instance
     * @param {Object} config - Configuration object containing API settings
     */
    constructor(config) {
        this.config = config;
        this.baseUrl = config.apis.bttv.baseUrl;
    }

    /**
     * Fetches channel-specific emotes from BTTV
     * @param {string} channelId - Twitch channel ID
     * @returns {Promise<Array>} Array of emote objects
     */
    async getChannelEmotes(channelId) {
        try {
            return await withRetry(async () => {
                const response = await axios.get(
                    `${this.baseUrl}/cached/users/twitch/${channelId}`,
                    { timeout: 5000 }
                );

                const channelEmotes = response.data.channelEmotes || [];
                const sharedEmotes = response.data.sharedEmotes || [];
                
                return [...channelEmotes, ...sharedEmotes].map(emote => ({
                    id: emote.id,
                    code: emote.code,
                    platform: 'bttv-channel',
                    animated: emote.imageType === 'gif'
                }));
            });
        } catch (error) {
            console.error('Error fetching BTTV channel emotes:', error.message);
            return [];
        }
    }

    /**
     * Fetches global emotes from BTTV
     * @returns {Promise<Array>} Array of emote objects
     */
    async getGlobalEmotes() {
        try {
            const response = await axios.get(`${this.baseUrl}/cached/emotes/global`);
            
            return response.data.map(emote => ({
                id: emote.id,
                code: emote.code,
                platform: 'bttv-global',
                animated: emote.imageType === 'gif'
            }));
        } catch (error) {
            console.error('Error fetching global BTTV emotes:', error.message);
            return [];
        }
    }
}

module.exports = BTTVService; 