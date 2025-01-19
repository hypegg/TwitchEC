const axios = require('axios');
const { withRetry } = require('../utils/api-helpers');

/**
 * Service for interacting with the 7TV API to fetch emotes
 */
class SevenTVService {
    /**
     * Creates a new SevenTVService instance
     * @param {Object} config - Configuration object containing API settings
     */
    constructor(config) {
        this.config = config;
        this.baseUrl = config.apis.sevenTv.baseUrl;
    }

    /**
     * Fetches channel-specific emotes from 7TV
     * @param {string} channelId - Twitch channel ID
     * @param {string} channelName - Twitch channel name
     * @returns {Promise<Array>} Array of emote objects with id, code, platform, and animated properties
     */
    async getChannelEmotes(channelId, channelName) {
        try {
            return await withRetry(async () => {
                const response = await axios.get(
                    `${this.baseUrl}/users/twitch/${channelId}`,
                    { timeout: 5000 }
                );
                const emoteSet = response.data?.emote_set;
                
                if (!emoteSet?.emotes?.length) {
                    return [];
                }

                return emoteSet.emotes.map(emote => ({
                    id: emote.id,
                    code: emote.name,
                    platform: '7tv-channel',
                    animated: emote.data?.animated ?? false
                }));
            });
        } catch (error) {
            console.error('Error fetching 7TV channel emotes:', error.message);
            return [];
        }
    }

    /**
     * Fetches global emotes from 7TV's global emote set
     * @returns {Promise<Array>} Array of emote objects with id, code, platform, and animated properties
     */
    async getGlobalEmotes() {
        try {
            const globalSetId = '62cdd34e72a832540de95857';
            const response = await axios.get(`${this.baseUrl}/emote-sets/${globalSetId}`);
            
            if (!response.data.emotes) {
                return [];
            }

            return response.data.emotes.map(emote => ({
                id: emote.id,
                code: emote.name,
                platform: '7tv-global',
                animated: emote.data.animated
            }));
        } catch (error) {
            console.error('Error fetching global 7TV emotes:', error.message);
            return [];
        }
    }
}

module.exports = SevenTVService;
