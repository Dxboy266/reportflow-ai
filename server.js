const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const app = express();
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Utils
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);

// Load Config
let config = {};
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

            // Migration for old config (if 'deepseek' exists but 'ai' doesn't)
            if (config.deepseek && !config.ai) {
                console.log("Migrating old DeepSeek config to new AI provider structure...");
                config.ai = {
                    provider: 'deepseek',
                    baseUrl: config.deepseek.baseUrl || 'https://api.deepseek.com/v1',
                    apiKey: config.deepseek.apiKey || '',
                    model: config.deepseek.model || 'deepseek-chat'
                };
                // We keep 'deepseek' key for safety or just delete it? Let's keep it but ignore it.
            }
        }
    } catch (e) {
        console.error('Error loading config:', e);
    }
}
loadConfig();

const PORT = config.server && config.server.port ? config.server.port : 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

async function ensureDir(dirPath) {
    try {
        await mkdirAsync(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getWeekPath(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const week = 'W' + String(getWeekNumber(date)).padStart(2, '0');
    return path.join(__dirname, 'data', String(year), month, week);
}

// Routes

// Get Config
app.get('/api/config', (req, res) => {
    res.json({
        ai: {
            provider: config.ai?.provider || 'deepseek',
            baseUrl: config.ai?.baseUrl || 'https://api.deepseek.com/v1',
            model: config.ai?.model || 'deepseek-chat',
            hasApiKey: !!(config.ai?.apiKey)
        }
    });
});

// Update Config
app.post('/api/config', async (req, res) => {
    try {
        const { provider, baseUrl, apiKey, model } = req.body;

        if (!config.ai) config.ai = {};

        if (provider) config.ai.provider = provider;
        if (baseUrl) config.ai.baseUrl = baseUrl;
        if (model) config.ai.model = model;
        if (apiKey) config.ai.apiKey = apiKey; // Only update if provided (not empty)

        // Persist
        await writeFileAsync(CONFIG_PATH, JSON.stringify(config, null, 4));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper for AI Request
async function callAI(systemPrompt, userPrompt) {
    if (!config.ai) {
        throw new Error("AI provider not configured");
    }

    const provider = config.ai.provider || 'deepseek';
    const baseUrl = config.ai.baseUrl || 'https://api.deepseek.com/v1';
    const model = config.ai.model || 'deepseek-chat';
    const apiKey = config.ai.apiKey || '';

    // Check if using Anthropic/Antigravity format
    const isAnthropic = provider === 'anthropic' || provider === 'antigravity';

    if (isAnthropic) {
        // --- Anthropic Format ---
        // Endpoint: /messages
        const url = baseUrl.endsWith('/') ? `${baseUrl}messages` : `${baseUrl}/messages`;

        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };

        const body = {
            model: model,
            messages: [
                // Anthropic system usually goes to top-level parameter, but messages[0] with role 'user' works for simple cases.
                // However, correct Anthropic chat format: system is "system" top param, messages is list of user/assistant.
                { role: "user", content: `${systemPrompt}\n\nUser Input:\n${userPrompt}` }
                // Merging system prompt into user message for simplicity as Anthropic messages array doesn't support 'system' role in older versions, 
                // though newer ones use top-level 'system'. Let's use top-level system if possible, but merging is safer for proxies.
                // Actually, standard Anthropic API supports 'system' parameter.
            ],
            system: systemPrompt,
            max_tokens: 4096
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || JSON.stringify(data.error) || 'API Error');
        }

        // Response format: { content: [ { type: 'text', text: '...' } ] }
        if (!data.content || data.content.length === 0) {
            throw new Error('No response content returned from Anthropic API');
        }

        return data.content[0].text;

    } else {
        // --- OpenAI/DeepSeek Format (Default) ---
        // Endpoint: /chat/completions
        const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;

        const headers = {
            'Content-Type': 'application/json'
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || JSON.stringify(data.error) || 'API Error');
        }

        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response choices returned from AI');
        }

        return data.choices[0].message.content;
    }
}

// Generate Daily Report
app.post('/api/generate-daily', async (req, res) => {
    const { content, style } = req.body;

    // Get current date in readable format
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
        const report = await callAI(systemPrompt, content);
        res.json({ success: true, report });
    } catch (error) {
        console.error("Generate daily error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check if report exists
app.get('/api/check-exists', async (req, res) => {
    const { type, date } = req.query; // date format: YYYY-MM-DD
    const today = date ? new Date(date) : new Date();

    // Ensure we parse the date string correctly if provided
    // If not provided, use today. logic below handles path generation

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

// Save Daily Report
app.post('/api/save-daily', async (req, res) => {
    const { date, rawContent, generatedReport, style } = req.body;
    try {
        const weeklyPath = getWeekPath(date);
        const dailyDir = path.join(weeklyPath, 'daily');
        await ensureDir(dailyDir);

        const fileName = `${date.substring(5)}.json`; // MM-DD.json
        const filePath = path.join(dailyDir, fileName);

        const data = {
            date,
            weekday: new Date(date).toLocaleDateString('zh-CN', { weekday: 'long' }),
            rawContent,
            generatedReport,
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
app.get('/api/current-week/dailies', async (req, res) => {
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

        // Sort by date
        dailies.sort((a, b) => a.date.localeCompare(b.date));

        res.json({ dailies });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate Weekly Report
app.post('/api/generate-weekly', async (req, res) => {
    const { dates, style } = req.body;

    // Fetch dailies if not provided (default logic)
    let dailyContents = [];
    if (!dates) {
        const today = new Date();
        const weekPath = getWeekPath(today.toISOString().split('T')[0]);
        const dailyDir = path.join(weekPath, 'daily');
        if (fs.existsSync(dailyDir)) {
            const files = await fs.promises.readdir(dailyDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = JSON.parse(await readFileAsync(path.join(dailyDir, file), 'utf8'));
                    dailyContents.push(`【${content.date} ${content.weekday}】\n${content.generatedReport}`);
                }
            }
        }
    }

    if (dailyContents.length === 0) {
        return res.status(400).json({ success: false, error: "No dailies found for this week" });
    }

    const systemPrompt = `你是一个专业的周报汇总助手。请根据以下本周的每日日报内容，生成一份高质量的周报。
    
    要求：
    1. 提炼核心成果，不要流水账。
    2. 分类汇总，如【本周工作重点】、【项目进度】、【存在问题】、【下周计划】。
    3. 语气${style === 'casual' ? '轻松自然' : (style === 'tech' ? '技术专业' : '正式得体')}。
    
    仅返回生成的内容。`;

    try {
        const report = await callAI(systemPrompt, dailyContents.join('\n\n'));
        res.json({ success: true, report, includedDays: dailyContents.length });
    } catch (error) {
        console.error("Generate weekly error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save Weekly Report
app.post('/api/save-weekly', async (req, res) => {
    const { generatedReport, style } = req.body;
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    try {
        const weeklyPath = getWeekPath(dateStr);
        await ensureDir(weeklyPath);

        const filePath = path.join(weeklyPath, 'weekly.json');

        const data = {
            weekNumber: getWeekNumber(today),
            generatedReport,
            style,
            createdAt: new Date().toISOString()
        };

        await writeFileAsync(filePath, JSON.stringify(data, null, 2));
        res.json({ success: true, path: filePath });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
