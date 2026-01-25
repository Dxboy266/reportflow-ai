const express = require('express');
const router = express.Router();
const { getConfig, saveConfig } = require('../config');
const { getDataRoot } = require('../utils/dateUtils'); // Import for current path display

router.get('/', (req, res) => {
    const config = getConfig();
    res.json({
        ai: {
            provider: config.ai?.provider || 'deepseek',
            baseUrl: config.ai?.baseUrl || 'https://api.deepseek.com/v1',
            model: config.ai?.model || 'deepseek-chat',
            hasApiKey: !!(config.ai?.apiKey)
        },
        dataDir: config.dataDir || '',
        currentDataPath: getDataRoot()
    });
});

// Select Path (Electron Only)
router.post('/select-path', async (req, res) => {
    try {
        // Dynamically require electron to avoid crash in pure Node mode
        // Note: 'electron' module is available if running via 'electron .'
        const electron = require('electron');
        const { dialog, BrowserWindow } = electron;

        const win = BrowserWindow.getAllWindows()[0];

        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory', 'createDirectory'],
            title: '选择数据存储位置',
            buttonLabel: '确认选择'
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const selectedPath = result.filePaths[0];

            // Validate: check if writable?
            // Save to config
            const config = getConfig();
            config.dataDir = selectedPath;
            saveConfig(config);

            res.json({ success: true, path: selectedPath });
        } else {
            res.json({ success: false, cancelled: true });
        }
    } catch (error) {
        console.error("Select Path Error:", error);
        res.status(500).json({ success: false, error: '此功能仅在桌面版应用中可用 (Electron)' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { provider, baseUrl, apiKey, model, dataDir } = req.body;
        const config = getConfig();
        if (!config.ai) config.ai = {};

        if (provider) config.ai.provider = provider;
        if (baseUrl) config.ai.baseUrl = baseUrl;
        if (model) config.ai.model = model;
        if (apiKey) config.ai.apiKey = apiKey;

        // Manual input of dataDir support
        if (dataDir !== undefined) config.dataDir = dataDir;

        saveConfig(config);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
