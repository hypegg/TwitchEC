const axios = require('axios');
const { withRetry } = require('../utils/api-helpers');

/**
 * Service for interacting with the FrankerFaceZ API
 */
class FFZService {
    /**
     * Creates a new FFZService instance
     * @param {Object} config - Configuration object containing API settings
     */
    constructor(config) {
        this.config = config;
        this.baseUrl = config.apis.ffz.baseUrl;
    }

    /**
     * Fetches channel-specific emotes from FFZ
     * @param {string} channelId - Twitch channel ID
     * @returns {Promise<Array>} Array of emote objects
     */
    async getChannelEmotes(channelId) {
        try {
            return await withRetry(async () => {
                const response = await axios.get(
                    `${this.baseUrl}/room/id/${channelId}`,
                    { timeout: 5000 }
                );

                if (!response.data?.sets) {
                    return [];
                }

                const emotes = [];
                Object.values(response.data.sets).forEach(set => {
                    if (set.emoticons) {
                        set.emoticons.forEach(emote => {
                            emotes.push({
                                id: emote.id.toString(),
                                code: emote.name,
                                platform: 'ffz',
                                animated: false // FFZ doesn't support animated emotes in the same way
                            });
                        });
                    }
                });

                console.log(`FFZ channel emotes fetched for ${channelId}:`, emotes.length);

                return emotes;
            });
        } catch (error) {
            console.error('Error fetching FFZ channel emotes:', error.message);
            return [];
        }
    }

    /**
     * Fetches global emotes from FFZ
     * @returns {Promise<Array>} Array of emote objects
     */
    async getGlobalEmotes() {
        try {
            const response = await axios.get(`${this.baseUrl}/set/global`);
            
            if (!response.data?.sets?.default?.emoticons) {
                return [];
            }

            console.log('FFZ global emotes fetched:', response.data?.sets?.default?.emoticons?.length || 0);

            return response.data.sets.default.emoticons.map(emote => ({
                id: emote.id.toString(),
                code: emote.name,
                platform: 'ffz-global',
                animated: false
            }));
        } catch (error) {
            console.error('Error fetching global FFZ emotes:', error.message);
            return [];
        }
    }
}

module.exports = FFZService; 