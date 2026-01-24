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

    const systemPrompt = `你是一位资深的技术团队周报撰写专家。请根据以下本周的每日日报内容，生成一份结构严谨、重点突出、体现技术深度的高质量周报。

## 核心原则
1. **结构化输出**：严格按照【本周重点工作产出】、【遇到问题与解决方案】、【下周工作计划】、【个人总结】四个板块组织内容。
2. **逻辑归纳**：不要按时间流水账罗列，而是将同一类工作（如"业务需求"、"技术基建"、"故障排查"）进行合并归类。
3. **技术深度**：在描述工作时，体现解决问题的思路、使用的技术栈（K8s, Hadoop, Docker等）及产出的价值。
4. **量化与沉淀**：强调产出的文档、修复的Bug数、解决的难题以及沉淀的知识库。

## 输出格式（严格遵循 Markdown）

**邮件主题建议：** 周报_${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}[本周开始日]-[本周结束日]_[你的名字]

---

### 一、本周重点工作产出 (Key Results)

**1. [归类标题，如：业务迭代与需求交付]**
- **[具体任务]**：详细描述做了什么，达到了什么阶段（开发/自测/部署/联调）。
- **[具体任务]**：...

**2. [归类标题，如：工程环境修复与容器化攻坚]**
- **[具体任务]**：描述排查的问题、根因定位及最终解决方案。

**3. [归类标题，如：技术底座与知识沉淀]**
- **[具体任务]**：描述学习了什么新技术，输出了什么笔记/文档。

---

### 二、遇到的问题与解决方案 (Issues & Solutions)

- **[问题描述]**：简述遇到的卡点。
- **[解决方案]**：如何解决的，是否有沉淀文档。

---

### 三、下周工作计划 (Next Week Plan)

1. **[重点任务]**：描述下周的核心目标。
2. **[常规任务]**：描述配合测试或联调的工作。
3. **[学习/进阶]**：描述技术提升计划。

---

### 四、个人总结

（请根据本周工作内容，总结一段体现个人成长、技术感悟或对项目理解的话，语气诚恳且专业。）

请根据以上要求生成周报：`;

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
