require('dotenv').config();

const DEFAULT_URLS = {
    SEVENTV: 'https://7tv.io/v3',
    BTTV: 'https://api.betterttv.net/3',
    FFZ: 'https://api.frankerfacez.com/v1'
};

const AI_CONFIG = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        apiEndpoint: process.env.OPENAI_API_ENDPOINT,
        model: process.env.OPENAI_MODEL,
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE),
        systemPrompt: process.env.OPENAI_SYSTEM_PROMPT,
        userPromptTemplate: process.env.OPENAI_USER_PROMPT_TEMPLATE
    }
};

const config = {
    // Bot Authentication Settings
    username: process.env.TWITCH_USERNAME,          // Required: Twitch bot username
    token: process.env.TWITCH_TOKEN,                // Required: OAuth token without 'oauth:' prefix
    channel: process.env.TWITCH_CHANNEL,            // Required: Channel to monitor
    channelTwitchId: process.env.CHANNEL_ID,        // Optional: Known Twitch user ID

    // File Paths
    files: {
        database: process.env.DATABASE_PATH,            // Path to store chat statistics
        export: process.env.EXPORT_PATH,                // Path to export user rankings
        emotesCache: process.env.EMOTES_CACHE_PATH,     // Path to store emote cache
        statistics: process.env.STATISTICS_PATH,        // Path to store general statistics
        topUser: process.env.TOP_USER_FILE_PATH         // Add this line
    },

    format: {
        topUser: process.env.TOP_USER_FORMAT            // Add this line
    },

    // Timing Settings (in milliseconds)
    intervals: {
        autoSave: parseInt(process.env.AUTO_SAVE_INTERVAL, 10),             // How often to save statistics (5 minutes)
        emoteRefresh: parseInt(process.env.EMOTE_REFRESH_INTERVAL, 10)      // How often to refresh emotes (30 minutes)
    },

    // Feature Settings
    features: {
        maxTopUsers: parseInt(process.env.MAX_TOP_USERS, 10),       // Maximum number of users in rankings
        enableLogging: process.env.ENABLE_LOGGING === 'true',       // Enable detailed logging
        saveErrors: process.env.SAVE_ERRORS === 'true',              // Save error logs
        enableAiMessages: process.env.ENABLE_AI_MESSAGES === 'true'  // Add this line
    },

    // Platform Settings
    enabledPlatforms: {
        'twitch': process.env.ENABLE_TWITCH_EMOTES === 'true',              // Channel Twitch emotes
        'twitch-global': process.env.ENABLE_TWITCH_GLOBAL === 'true',       // Global Twitch emotes
        '7tv-channel': process.env.ENABLE_7TV_CHANNEL === 'true',           // Channel 7TV emotes
        '7tv-global': process.env.ENABLE_7TV_GLOBAL === 'true',             // Global 7TV emotes
        'bttv': process.env.ENABLE_BTTV_CHANNEL === 'true',                 // Channel BTTV emotes
        'bttv-global': process.env.ENABLE_BTTV_GLOBAL === 'true',           // Global BTTV emotes
        'ffz': process.env.ENABLE_FFZ_CHANNEL === 'true',                   // Channel FFZ emotes
        'ffz-global': process.env.ENABLE_FFZ_GLOBAL === 'true'              // Global FFZ emotes
    },

    // API Configuration
    apis: {
        twitch: {
            clientId: process.env.TWITCH_CLIENT_ID,
            clientSecret: process.env.TWITCH_CLIENT_SECRET,
            accessToken: process.env.TWITCH_ACCESS_TOKEN
        },
        sevenTv: {
            baseUrl: DEFAULT_URLS.SEVENTV,
            rateLimit: parseInt(process.env.SEVENTV_RATE_LIMIT, 10) || 60
        },
        bttv: {
            baseUrl: process.env.BTTV_BASE_URL || DEFAULT_URLS.BTTV,
            rateLimit: parseInt(process.env.BTTV_RATE_LIMIT, 10) || 60
        },
        ffz: {
            baseUrl: DEFAULT_URLS.FFZ,
            rateLimit: parseInt(process.env.FFZ_RATE_LIMIT, 10) || 60
        }
    },

    // Rate Limiting and Retry Settings
    retry: {
        attempts: parseInt(process.env.RETRY_ATTEMPTS, 10),     // Number of retry attempts
        delay: parseInt(process.env.RETRY_DELAY, 10),           // Initial delay in ms
        maxDelay: parseInt(process.env.RETRY_MAX_DELAY, 10)     // Maximum delay between retries
    },

    // Add milestone configuration
    milestones: {
        values: process.env.MILESTONE_VALUES ? 
            process.env.MILESTONE_VALUES.split(',').map(Number) : 
            [100, 500, 1000, 5000, 10000, 50000],
        messages: {}
    }
};

// Add default values for critical settings
const defaultConfig = {
    apis: {
        twitch: {
            clientId: config.apis.twitch.clientId,
            clientSecret: config.apis.twitch.clientSecret,
            accessToken: config.apis.twitch.accessToken,
            headers: {
                'Client-ID': config.apis.twitch.clientId,
                'Authorization': `Bearer ${config.apis.twitch.accessToken}`
            }
        }
    }
};

// Configuration validation
function validateConfig(config) {
    const required = {
        auth: ['username', 'token', 'channel'],
        apis: ['clientId', 'clientSecret', 'accessToken']
    };

    // Validate authentication settings
    const missingAuth = required.auth.filter(key => !config[key]);
    if (missingAuth.length) {
        throw new Error(`Missing required authentication settings: ${missingAuth.join(', ')}`);
    }

    // Validate API credentials
    const missingApi = required.apis.filter(key => !config.apis.twitch[key]);
    if (missingApi.length) {
        throw new Error(`Missing required Twitch API credentials: ${missingApi.join(', ')}`);
    }

    // Validate file paths
    Object.entries(config.files).forEach(([key, path]) => {
        if (!path) {
            throw new Error(`Invalid file path for: ${key}`);
        }
    });

    // Initialize APIs configuration if not present
    config.apis = config.apis || {};

    // Ensure each API has the required configuration
    const apiConfigs = {
        sevenTv: {
            baseUrl: process.env.SEVENTV_BASE_URL || DEFAULT_URLS.SEVENTV,
            rateLimit: parseInt(process.env.SEVENTV_RATE_LIMIT, 10) || 60
        },
        bttv: {
            baseUrl: process.env.BTTV_BASE_URL || DEFAULT_URLS.BTTV,
            rateLimit: parseInt(process.env.BTTV_RATE_LIMIT, 10) || 60
        },
        ffz: {
            baseUrl: process.env.FFZ_BASE_URL || DEFAULT_URLS.FFZ,
            rateLimit: parseInt(process.env.FFZ_RATE_LIMIT, 10) || 60
        }
    };

    // Merge API configurations
    config.apis = {
        ...config.apis,
        sevenTv: { ...apiConfigs.sevenTv, ...(config.apis.sevenTv || {}) },
        bttv: { ...apiConfigs.bttv, ...(config.apis.bttv || {}) },
        ffz: { ...apiConfigs.ffz, ...(config.apis.ffz || {}) }
    };

    // Add Twitch API headers
    if (config.apis.twitch) {
        config.apis.twitch.headers = {
            'Client-ID': config.apis.twitch.clientId,
            'Authorization': `Bearer ${config.apis.twitch.accessToken}`
        };
    }

    // Process milestone messages
    config.milestones.values.forEach(milestone => {
        const msgKey = `MILESTONE_${milestone}_MESSAGE`;
        const defaultMsg = `atingiu ${milestone} emotes! Parabéns! 🎉`;
        config.milestones.messages[milestone] = process.env[msgKey] || defaultMsg;
    });

    // Validate AI configuration when enabled
    if (config.features.enableAiMessages) {
        const requiredAiSettings = [
            'apiKey',
            'apiEndpoint',
            'model',
            'maxTokens',
            'temperature',
            'systemPrompt',
            'userPromptTemplate'
        ];

        const missingAiSettings = requiredAiSettings.filter(key => !AI_CONFIG.openai[key]);
        if (missingAiSettings.length) {
            throw new Error(`Missing required AI settings: ${missingAiSettings.join(', ')}`);
        }

        // Validate numeric values
        if (isNaN(AI_CONFIG.openai.maxTokens)) {
            throw new Error('OPENAI_MAX_TOKENS must be a valid number');
        }
        if (isNaN(AI_CONFIG.openai.temperature) || AI_CONFIG.openai.temperature < 0 || AI_CONFIG.openai.temperature > 2) {
            throw new Error('OPENAI_TEMPERATURE must be a valid number between 0 and 2');
        }
    }

    // Validate intervals
    if (isNaN(config.intervals.autoSave) || config.intervals.autoSave < 1000) {
        throw new Error('AUTO_SAVE_INTERVAL must be a valid number >= 1000');
    }
    if (isNaN(config.intervals.emoteRefresh) || config.intervals.emoteRefresh < 1000) {
        throw new Error('EMOTE_REFRESH_INTERVAL must be a valid number >= 1000');
    }

    // Validate retry settings
    if (isNaN(config.retry.attempts) || config.retry.attempts < 1) {
        throw new Error('RETRY_ATTEMPTS must be a valid number >= 1');
    }
    if (isNaN(config.retry.delay) || config.retry.delay < 0) {
        throw new Error('RETRY_DELAY must be a valid number >= 0');
    }
    if (isNaN(config.retry.maxDelay) || config.retry.maxDelay < config.retry.delay) {
        throw new Error('RETRY_MAX_DELAY must be a valid number >= RETRY_DELAY');
    }

    // Validate rate limits
    const apiServices = ['SEVENTV', 'BTTV', 'FFZ'];
    apiServices.forEach(service => {
        const rateLimitKey = `${service}_RATE_LIMIT`;
        const rateLimit = parseInt(process.env[rateLimitKey], 10);
        if (isNaN(rateLimit) || rateLimit < 1) {
            throw new Error(`${rateLimitKey} must be a valid number >= 1`);
        }
    });

    // Validate milestone values
    if (!Array.isArray(config.milestones.values) || config.milestones.values.length === 0) {
        throw new Error('MILESTONE_VALUES must be a comma-separated list of numbers');
    }
    config.milestones.values.forEach(milestone => {
        if (isNaN(milestone) || milestone < 1) {
            throw new Error('Each milestone value must be a valid number >= 1');
        }
    });

    // Validate feature settings
    if (isNaN(config.features.maxTopUsers) || config.features.maxTopUsers < 1) {
        throw new Error('MAX_TOP_USERS must be a valid number >= 1');
    }

    // Validate required format strings
    if (!config.format.topUser || !config.format.topUser.includes('{username}')) {
        throw new Error('TOP_USER_FORMAT must include at least {username} variable');
    }

    // Add AI configuration to config object if enabled
    if (config.features.enableAiMessages) {
        config.ai = AI_CONFIG;
    }

    return config;
}

module.exports = validateConfig(config);
