const axios = require('axios');

/**
 * Service for interacting with Twitch's emote-related APIs
 */
class TwitchEmoteService {
    /**
     * Creates a new TwitchEmoteService instance
     * @param {Object} config - Configuration object containing API credentials
     */
    constructor(config) {
        this.config = config;
    }

    /**
     * Retrieves a Twitch user's ID by their username
     * @param {string} username - The Twitch username
     * @returns {Promise<string|null>} The user's ID or null if not found
     */
    async getUserId(username) {
        try {
            const response = await axios.get(
                `https://api.twitch.tv/helix/users?login=${username}`,
                { headers: this.config.apis.twitch.headers }
            );
            return response.data.data[0]?.id;
        } catch (error) {
            console.error('Error getting Twitch user ID:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Fetches channel-specific emotes for a given channel
     * @param {string} channelId - The Twitch channel ID
     * @returns {Promise<Array<{id: string, code: string, platform: string}>>} Array of channel emotes
     */
    async getChannelEmotes(channelId) {
        try {
            const response = await axios.get(
                `https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${channelId}`,
                { headers: this.config.apis.twitch.headers }
            );
            return response.data.data.map(emote => ({
                id: emote.id,
                code: emote.name,
                platform: 'twitch'
            }));
        } catch (error) {
            console.error('Error fetching Twitch emotes:', error.message);
            return [];
        }
    }

    /**
     * Fetches global Twitch emotes available to all channels
     * @returns {Promise<Array<{id: string, code: string, platform: string}>>} Array of global emotes
     */
    async getGlobalEmotes() {
        try {
            const response = await axios.get(
                'https://api.twitch.tv/helix/chat/emotes/global',
                { headers: this.config.apis.twitch.headers }
            );
            return response.data.data.map(emote => ({
                id: emote.id,
                code: emote.name,
                platform: 'twitch-global'
            }));
        } catch (error) {
            console.error('Error fetching global Twitch emotes:', error.message);
            return [];
        }
    }
}

module.exports = TwitchEmoteService;
