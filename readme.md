# TwitchEC

A Twitch Emote Counter that tracks and displays the usage of emotes in real-time for Twitch streams.

---

## Overview
This tool is built to enhance viewer engagement and provide valuable metrics for streamers.

---

## Features
- **Real-time emote tracking**: Monitor and count emotes used in chat instantly.
- **Easy to configure**: Use an `.env` file for your credentials and configurations.
- **Simple commands**: Built-in scripts for quick setup and operation.
- **Customizable**: Extend the tool using the provided source code.

---

## Prerequisites
Before running this project, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (Tested on v16.2)

---

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/hypegg/TwitchEC
   cd TwitchEC
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   Alternatively, use the provided batch script:
   ```bash
   install-dependencies.bat
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Fill in the required credentials (Twitch API keys, etc.) in the `.env` file.

---

## Usage

1. Start the application:
   ```bash
   npm start
   ```

   Or use the provided batch script:
   ```bash
   start.bat
   ```

2. Reset the application state if needed:
   ```bash
   reset.bat
   ```

---

## Built With
- **[axios](https://github.com/axios/axios)**: For making HTTP requests.
- **[chalk](https://github.com/chalk/chalk)**: For colorful console outputs.
- **[dotenv](https://github.com/motdotla/dotenv)**: For environment variable management.
- **[tmi.js](https://github.com/tmijs/tmi.js)**: Twitch messaging interface for chat interaction.
- **[yargs](https://github.com/yargs/yargs)**: For argument parsing.

---

## Contribution
Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch for your feature/bugfix.
3. Commit your changes and open a pull request.

---

## License
This project is licensed under the [MIT License](LICENSE).