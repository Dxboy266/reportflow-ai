const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { streamAI } = require('../services/aiService');
const { getWeekPath } = require('../utils/dateUtils');
const { ensureDir, writeFileAsync, readFileAsync } = require('../utils/fileUtils');

// Generate Daily
router.post('/generate-daily', async (req, res) => {
    const { content, style } = req.body;
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;
    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdayNames[today.getDay()];

    const systemPrompt = `你是一位资深的技术团队日报撰写专家。你的任务是将用户提供的简单工作描述，专业化包装成一份高质量、有深度、体现工作量的技术日报。

**今天是：${dateStr} ${weekday}**

## 核心原则
1. **放大工作价值**：即使是修复一个小 Bug，也要拆解成"问题定位 → 根因分析 → 方案实施 → 验证测试"的完整链路。
2. **技术深度包装**：适当使用专业术语（如：链路追踪、性能调优、容器编排、分布式事务等），但不要过度堆砌。
3. **量化成果**：尽可能加入数据或具体描述（如"优化后接口响应时间降低 30%"、"覆盖 5 个核心场景"）。
4. **知识沉淀体现**：如果涉及学习或排查问题，要体现知识转化（如"整理归档至团队知识库"、"补充至避坑指南"）。

## 输出格式（严格遵循）

**邮件主题建议：** ${dateStr} 工作日报 - [主要工作关键词概括]

---

### 一、今日工作明细

**1. [任务名称/模块名称]**
- **背景/目标**：简述任务的来源或要解决的问题
- **具体工作**：
  - 子任务1：具体做了什么，涉及哪些技术点
  - 子任务2：...
- **成果/进度**：当前进展或产出物

**2. [如有第二项工作，同上格式]**
...

---

### 二、问题与收获（可选，如有则写）

- **遇到的问题**：简述卡点
- **解决思路**：如何定位和解决
- **技术沉淀**：学到了什么，是否可复用

---

### 三、明日计划

1. [计划1] - 预期产出
2. [计划2] - 预期产出

---

## 风格要求
- 语气：${style === 'casual' ? '轻松专业，可适当加入程序员黑话或幽默感' : (style === 'tech' ? '严谨技术向，侧重实现细节和技术术语' : '正式得体，适合发送给领导或跨部门同事')}
- 不要生成 Markdown 代码块标记
- 不要生成与日报内容无关的解释性文字

请根据用户输入的内容，生成高质量日报：`;

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
