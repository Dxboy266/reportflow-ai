const express = require('express');
const router = express.Router();
const { getConfig, saveConfig } = require('../config');

router.get('/', (req, res) => {
    const config = getConfig();
    res.json({
        ai: {
            provider: config.ai?.provider || 'deepseek',
            baseUrl: config.ai?.baseUrl || 'https://api.deepseek.com/v1',
            model: config.ai?.model || 'deepseek-chat',
            hasApiKey: !!(config.ai?.apiKey)
        }
    });
});

router.post('/', async (req, res) => {
    try {
        const { provider, baseUrl, apiKey, model } = req.body;
        const config = getConfig();
        if (!config.ai) config.ai = {};

        if (provider) config.ai.provider = provider;
        if (baseUrl) config.ai.baseUrl = baseUrl;
        if (model) config.ai.model = model;
        if (apiKey) config.ai.apiKey = apiKey;

        saveConfig(config);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
