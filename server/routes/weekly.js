const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { streamAI } = require('../services/aiService');
const { getWeekPath, getWeekNumber } = require('../utils/dateUtils');
const { ensureDir, writeFileAsync, readFileAsync } = require('../utils/fileUtils');

// Generate Weekly Report
router.post('/generate-weekly', async (req, res) => {
    const { dates, style } = req.body;

    // Fetch dailies if not provided (default logic)
    let dailyContents = [];
    if (!dates) {
        const today = new Date();
        const weekPath = getWeekPath(today.toISOString().split('T')[0]);
        const dailyDir = path.join(weekPath, 'daily');
        if (fs.existsSync(dailyDir)) {
            const files = await fs.promises.readdir(dailyDir);
            const dailies = [];

            // Read all files first
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = JSON.parse(await readFileAsync(path.join(dailyDir, file), 'utf8'));
                    dailies.push(content);
                }
            }

            // Sort Ascending (Monday -> Friday) for Report Generation
            dailies.sort((a, b) => a.date.localeCompare(b.date));

            // Format - IMPORTANT: Remove <think> content from daily reports to save tokens
            dailyContents = dailies.map(content => {
                // Strip thinking content from generated report
                const cleanReport = content.generatedReport
                    .replace(/<think>[\s\S]*?<\/think>/g, '')
                    .trim();
                return `【${content.date} ${content.weekday}】\n${cleanReport}`;
            });
        }
    }

    if (dailyContents.length === 0) {
        return res.status(400).json({ success: false, error: "No dailies found for this week" });
    }

    const { getWeeklyPrompt } = require('../prompts/weeklyPrompt');

    const emailSubjectDateStr = `周报_${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}[本周开始日]-[本周结束日]_[你的名字]`;
    const systemPrompt = getWeeklyPrompt(emailSubjectDateStr);

    try {
        await streamAI(res, systemPrompt, dailyContents.join('\n\n'));
    } catch (error) {
        if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
    }
});

// Save Weekly Report
router.post('/save-weekly', async (req, res) => {
    const { generatedReport, style } = req.body;
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    try {
        const weeklyPath = getWeekPath(dateStr);
        await ensureDir(weeklyPath);

        const filePath = path.join(weeklyPath, 'weekly.json');

        // Strip thinking content before saving (safety backup)
        const cleanReport = generatedReport
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .trim();

        const data = {
            weekNumber: getWeekNumber(today),
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

module.exports = router;
