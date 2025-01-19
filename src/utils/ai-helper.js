const { default: axios } = require('axios');

/**
 * AIHelper class for handling OpenAI API interactions
 * Generates milestone celebration messages for Twitch chat
 */
class AIHelper {
    /**
     * Creates an instance of AIHelper
     * @param {Object} config - Configuration object
     */
    constructor(config) {
        // Core configuration
        this.config = config;
        this.apiKey = process.env.OPENAI_API_KEY;
        this.apiEndpoint = process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1';
        this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
        
        // AI behavior configuration
        this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 60;
        this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7;
        this.systemPrompt = process.env.OPENAI_SYSTEM_PROMPT || 
            'You are a Twitch chat bot that generates short, fun, and encouraging milestone messages. Keep responses under 150 characters. You always answer in Brazilian Portuguese.';
        
        // Response configuration
        this.maxResponseLength = parseInt(process.env.OPENAI_MAX_RESPONSE_LENGTH, 10) || 150;
        this.userPromptTemplate = process.env.OPENAI_USER_PROMPT_TEMPLATE || 
            'Generate a celebratory message for {username} who just reached {milestone} emotes used in chat. Include emojis.';
    }

    /**
     * Generates a milestone celebration message using OpenAI API
     * @param {string} username - The username to celebrate
     * @param {number} milestone - The milestone number achieved
     * @returns {Promise<string|null>} The generated message or null if failed
     */
    async generateMilestoneMessage(username, milestone) {
        if (!this.apiKey) return null;

        try {
            // Prepare the prompt by replacing placeholders
            const userPrompt = this.userPromptTemplate
                .replace('{username}', username)
                .replace('{milestone}', milestone);

            // Make API request to OpenAI
            const response = await axios.post(
                `${this.apiEndpoint}/chat/completions`,
                {
                    model: this.model,
                    messages: [{
                        role: 'system',
                        content: this.systemPrompt
                    }, {
                        role: 'user',
                        content: userPrompt
                    }],
                    max_tokens: this.maxTokens,
                    temperature: this.temperature
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            let content = response.data.choices[0]?.message?.content?.trim();
            
            // Truncate response if it exceeds maximum length
            if (content && content.length > this.maxResponseLength) {
                content = content.substring(0, this.maxResponseLength);
            }

            return content;
        } catch (error) {
            console.error('Error generating AI milestone message:', error.message);
            return null;
        }
    }
}

module.exports = AIHelper;
