const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

let config = {};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

            // Migration logic
            if (config.deepseek && !config.ai) {
                console.log("Migrating config...");
                config.ai = {
                    provider: 'deepseek',
                    baseUrl: config.deepseek.baseUrl || 'https://api.deepseek.com/v1',
                    apiKey: config.deepseek.apiKey || '',
                    model: config.deepseek.model || 'deepseek-chat'
                };
            }
        }
    } catch (e) {
        console.error('Error loading config:', e);
    }
}

function getConfig() {
    return config;
}

function saveConfig(newConfig) {
    config = newConfig;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
}

// Init load
loadConfig();

module.exports = { getConfig, saveConfig, loadConfig, CONFIG_PATH };
