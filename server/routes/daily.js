const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { streamAI } = require('../services/aiService');
const { getWeekPath } = require('../utils/dateUtils');
const { ensureDir, writeFileAsync, readFileAsync } = require('../utils/fileUtils');

const { getDailyPrompt } = require('../prompts/dailyPrompt');

// Generate Daily
router.post('/generate-daily', async (req, res) => {
    const { content, style } = req.body;
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;
    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdayNames[today.getDay()];

    const systemPrompt = getDailyPrompt(dateStr, weekday, style);

    try {
        await streamAI(res, systemPrompt, content);
    } catch (error) {
        if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
    }
});

// Check Exists
router.get('/check-exists', async (req, res) => {
    const { type, date } = req.query; // date format: YYYY-MM-DD
    const today = date ? new Date(date) : new Date();

    try {
        let exists = false;
        if (type === 'daily') {
            const weekPath = getWeekPath(today.toISOString().split('T')[0]);
            const dailyDir = path.join(weekPath, 'daily');
            const fileName = `${today.toISOString().split('T')[0].substring(5)}.json`; // MM-DD.json
            const filePath = path.join(dailyDir, fileName);
            exists = fs.existsSync(filePath);
        } else if (type === 'weekly') {
            const weekPath = getWeekPath(today.toISOString().split('T')[0]);
            const filePath = path.join(weekPath, 'weekly.json');
            exists = fs.existsSync(filePath);
        }
        res.json({ exists });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Save Daily
router.post('/save-daily', async (req, res) => {
    const { date, rawContent, generatedReport, style } = req.body;
    try {
        const weeklyPath = getWeekPath(date);
        const dailyDir = path.join(weeklyPath, 'daily');
        await ensureDir(dailyDir);

        const fileName = `${date.substring(5)}.json`; // MM-DD.json
        const filePath = path.join(dailyDir, fileName);

        const cleanReport = generatedReport
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .trim();

        const data = {
            date,
            weekday: new Date(date).toLocaleDateString('zh-CN', { weekday: 'long' }),
            rawContent,
            generatedReport: cleanReport,
            style,
            createdAt: new Date().toISOString()
        };

        await writeFileAsync(filePath, JSON.stringify(data, null, 2));
        res.json({ success: true, path: filePath });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Current Week Dailies
router.get('/current-week/dailies', async (req, res) => {
    const today = new Date();
    const weekPath = getWeekPath(today.toISOString().split('T')[0]);
    const dailyDir = path.join(weekPath, 'daily');

    try {
        if (!fs.existsSync(dailyDir)) {
            return res.json({ dailies: [] });
        }

        const files = await fs.promises.readdir(dailyDir);
        const dailies = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const content = await readFileAsync(path.join(dailyDir, file), 'utf8');
                dailies.push(JSON.parse(content));
            }
        }
        dailies.sort((a, b) => b.date.localeCompare(a.date));
        res.json({ dailies });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
