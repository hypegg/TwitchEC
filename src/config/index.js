require('dotenv').config();

const DEFAULT_URLS = {
    SEVENTV: 'https://7tv.io/v3',
    BTTV: 'https://api.betterttv.net/3',
    FFZ: 'https://api.frankerfacez.com/v1'
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

    return config;
}

module.exports = validateConfig(config);
