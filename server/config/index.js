const fs = require('fs');
const path = require('path');

const CONFIG_PATH = (() => {
    const isElectron = process.versions && process.versions.electron;
    if (isElectron) {
        const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
        const configDir = path.join(appData, 'ReportFlowAI');
        // Ensure directory exists
        if (!fs.existsSync(configDir)) {
            try { fs.mkdirSync(configDir, { recursive: true }); } catch (e) {
                console.error("Failed to create config dir:", e);
            }
        }
        return path.join(configDir, 'config.json');
    }
    return path.join(process.cwd(), 'config.json');
})();

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
