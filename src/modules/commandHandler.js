const chalk = require('chalk');
const config = require('../config');
const emoteManager = require('../modules/emoteManager');

/**
 * Handles command processing and execution for the Twitch bot
 * @class CommandHandler
 */
class CommandHandler {
    /**
     * Creates an instance of CommandHandler
     * @param {Object} bot - The main bot instance
     */
    constructor(bot) {
        this.bot = bot;
        
        // Rate limiting maps
        this.commandCooldowns = new Map();
        this.rateLimit = new Map();

        // Command definitions
        this.commands = {
            'stats': {
                aliases: ['s', 'info'],
                usage: '!stats [username]',
                description: 'Mostra estatísticas de uso de emotes de um usuário'
            },
            'top': {
                aliases: ['leaderboard', 'ranking', 't'],
                usage: '!top',
                description: 'Exibe o top 3 usuários com mais emotes'
            },
            'emote': {
                aliases: ['e', 'emoteinfo'],
                usage: '!emote <nome_do_emote>',
                description: 'Mostra informações sobre um emote específico'
            },
            'rank': {
                aliases: ['r', 'position'],
                usage: '!rank',
                description: 'Mostra sua posição no ranking'
            },
            'platforms': {
                aliases: ['p', 'sources'],
                usage: '!platforms',
                description: 'Exibe estatísticas de uso por plataforma'
            },
            'help': {
                aliases: ['h', 'commands', 'ajuda'],
                usage: '!help [comando]',
                description: 'Lista todos os comandos disponíveis'
            }
        };

        // Cleanup interval for rate limiting
        setInterval(() => {
            const now = Date.now();
            for (const [key, time] of this.commandCooldowns) {
                if (now - time > 3600000) { // 1 hour
                    this.commandCooldowns.delete(key);
                }
            }
            for (const [key, time] of this.rateLimit) {
                if (now - time > 3600000) {
                    this.rateLimit.delete(key);
                }
            }
        }, 3600000);
    }

    /**
     * Checks if a user has exceeded the rate limit
     * @param {string} username - The username to check
     * @returns {boolean} True if rate limited, false otherwise
     */
    isRateLimited(username) {
        const now = Date.now();
        const lastCommand = this.rateLimit.get(username) || 0;
        if (now - lastCommand < 1000) { // 1 second global rate limit
            return true;
        }
        this.rateLimit.set(username, now);
        return false;
    }

    /**
     * Main command processing method
     * @param {string} channel - The channel where the command was issued
     * @param {string} username - The user who issued the command
     * @param {string} command - The command string including arguments
     */
    async handleCommand(channel, username, command) {
        try {
            // Rate limit check
            if (this.isRateLimited(username)) {
                return;
            }

            // Command parsing
            const args = command.split(' ');
            let cmd = args[0].toLowerCase();

            // Command resolution
            const mainCommand = Object.entries(this.commands).find(([_, info]) => 
                cmd === _ || info.aliases.includes(cmd)
            );

            // Invalid command handling
            if (!mainCommand) {
                this.sendResponse(channel, username, '❌ Comando não reconhecido. Use !help para ver os comandos disponíveis.');
                return;
            }

            // Command execution setup
            cmd = mainCommand[0]; // Use the main command name

            // Cooldown management
            const now = Date.now();
            const cooldownKey = `${username}-${cmd}`;
            const lastUsed = this.commandCooldowns.get(cooldownKey) || 0;
            if (now - lastUsed < 3000) {
                return;
            }
            this.commandCooldowns.set(cooldownKey, now);
            this.bot.statsHandler.metrics.commandsExecuted++;

            const targetUser = args[1]?.toLowerCase();

            // Command implementations
            switch (cmd) {
                case 'help': {
                    if (targetUser) {
                        const cmdInfo = this.commands[targetUser] || 
                            Object.entries(this.commands).find(([_, info]) => 
                                info.aliases.includes(targetUser)
                            )?.[1];

                        if (cmdInfo) {
                            this.sendResponse(channel, username,
                                `ℹ️ ${cmdInfo.usage} - ${cmdInfo.description} │ ` +
                                `Aliases: ${cmdInfo.aliases.map(a => '!' + a).join(', ')}`
                            );
                        } else {
                            this.sendResponse(channel, username, '❌ Comando não encontrado');
                        }
                    } else {
                        const commandList = Object.entries(this.commands)
                            .map(([cmd, info]) => `!${cmd}`)
                            .join(', ');
                        this.sendResponse(channel, username,
                            `📚 Comandos disponíveis: ${commandList} │ Use !help <comando> para mais detalhes`
                        );
                    }
                    break;
                }

                case 'stats': {
                    const stats = await this.bot.statsHandler.getUserStats(targetUser || username);
                    if (!stats) {
                        this.sendResponse(channel, username, `@${targetUser || username} ainda não usou nenhum emote rastreado 🤔`);
                        return;
                    }
                    const timeActive = Math.floor((Date.now() - stats.firstSeen) / (1000 * 60 * 60 * 24));
                    const mostUsed = this.bot.statsHandler.getMostUsedEmote(stats.emotes);
                    this.bot.client.say(channel, 
                        `@${targetUser || username} → Total: ${stats.total} emotes | ` +
                        `Ativo: ${timeActive} dias | Favorito: ${mostUsed} ` +
                        `(${stats.emotes[mostUsed] || 0}x) 📊`);
                    break;
                }

                case 'top': {
                    const userStats = this.bot.statsHandler.userStats || {};
                    const topUsers = Object.entries(userStats)
                        .filter(([_, stats]) => stats && typeof stats.total === 'number')
                        .sort((a, b) => b[1].total - a[1].total)
                        .slice(0, 3);

                    if (topUsers.length === 0) {
                        this.bot.client.say(channel, "Ainda não há estatísticas registradas 📊");
                        return;
                    }

                    const topList = topUsers
                        .map((user, i) => `${i + 1}. ${user[0]}: ${user[1].total}`)
                        .join(' │ ');
                    this.bot.client.say(channel, `🏆 Top ${topUsers.length}: ${topList}`);
                    break;
                }

                case 'emote': {
                    if (!args[1]) {
                        this.bot.client.say(channel, '❌ Uso: !emote <nome_do_emote>');
                        return;
                    }
                    const emoteName = args[1];
                    const emoteInfo = emoteManager.getEmoteInfo(emoteName);
                    if (!emoteInfo) {
                        this.bot.client.say(channel, `❌ Emote "${emoteName}" não encontrado`);
                        return;
                    }
                    const usageCount = this.bot.getEmoteUsageCount(emoteName);
                    this.bot.client.say(channel, 
                        `Emote "${emoteName}" (${emoteInfo.platform}) → ` +
                        `Usado ${usageCount}x no total 🎯`);
                    break;
                }

                case 'rank': {
                    const userStats = this.bot.statsHandler.userStats || {};
                    const stats = userStats[username];
                    
                    if (!stats || !stats.total) {
                        this.bot.client.say(channel, `@${username} ainda não está ranqueado 📊`);
                        return;
                    }

                    const position = Object.values(userStats)
                        .filter(user => user && typeof user.total === 'number')
                        .sort((a, b) => b.total - a.total)
                        .findIndex(user => user.total === stats.total) + 1;

                    this.bot.client.say(channel, 
                        `@${username} → Rank #${position} │ ` +
                        `Total: ${stats.total} emotes 🏆`);
                    break;
                }

                case 'platforms': {
                    const userStats = this.bot.statsHandler.userStats || {};
                    
                    // Aggregate emotes by platform
                    const platformStats = Object.values(userStats)
                        .filter(stats => stats && stats.emotes)
                        .reduce((platforms, user) => {
                            Object.entries(user.emotes).forEach(([emote, count]) => {
                                const emoteInfo = emoteManager.getEmoteInfo(emote);
                                if (emoteInfo && emoteInfo.platform) {
                                    platforms[emoteInfo.platform] = (platforms[emoteInfo.platform] || 0) + count;
                                }
                            });
                            return platforms;
                        }, {});

                    if (Object.keys(platformStats).length === 0) {
                        this.bot.client.say(channel, "Ainda não há estatísticas por plataforma 📊");
                        return;
                    }

                    const statsStr = Object.entries(platformStats)
                        .sort((a, b) => b[1] - a[1]) // Sort by usage count
                        .map(([platform, count]) => `${platform}: ${count}`)
                        .join(' │ ');
                    this.bot.client.say(channel, `📊 Uso por plataforma: ${statsStr}`);
                    break;
                }

                case 'metrics': {
                    if (username !== config.channel) return; // Admin only
                    const { messagesProcessed, emotesDetected, commandsExecuted } = this.bot.metrics;
                    this.bot.client.say(channel, 
                        `📊 Métricas → Mensagens: ${messagesProcessed} │ ` +
                        `Emotes: ${emotesDetected} │ Comandos: ${commandsExecuted}`);
                    break;
                }
            }
        } catch (error) {
            // Error handling
            console.error(chalk.red('Command error:'), error);
            this.sendResponse(channel, username, '❌ Ocorreu um erro ao processar o comando');
        }
    }

    /**
     * Safely sends a response to the channel
     * @param {string} channel - The channel to send the message to
     * @param {string} username - The user the response is for
     * @param {string} message - The message to send
     */
    async sendResponse(channel, username, message) {
        try {
            await this.bot.client.say(channel, `${message}`);
        } catch (error) {
            console.error(chalk.red('Failed to send response:'), error);
        }
    }
}

module.exports = CommandHandler;
