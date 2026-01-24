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

// Helper for AI Request (Streaming)
async function streamAI(res, systemPrompt, userPrompt) {
    if (!config.ai) throw new Error("AI provider not configured");

    const provider = config.ai.provider || 'deepseek';
    const baseUrl = config.ai.baseUrl || 'https://api.deepseek.com/v1';
    const model = config.ai.model || 'deepseek-chat';
    const apiKey = config.ai.apiKey || '';
    const isAnthropic = provider === 'anthropic' || provider === 'antigravity';

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    if (isAnthropic) {
        delete headers['Authorization'];
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
    }

    const endpoint = isAnthropic ?
        (baseUrl.endsWith('/') ? `${baseUrl}messages` : `${baseUrl}/messages`) :
        (baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`);

    const body = isAnthropic ? {
        model,
        messages: [{ role: "user", content: `${systemPrompt}\n\nUser Input:\n${userPrompt}` }],
        system: systemPrompt,
        max_tokens: 4096,
        stream: true
    } : {
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 16384, // Ensure enough tokens for both thinking and content
        stream: true
    };

    try {
        const aiRes = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            throw new Error(`AI API Error: ${aiRes.status} ${errText}`);
        }

        // Set up SSE headers for client
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Pipe/Parse Logic
        // We need to read the AI stream, parse logic, and send clean text chunks to client
        // For simplicity in this demo, we'll try to just forward raw chunks wrapped in a standard format?
        // No, client needs clean text. We must parse here.

        const stream = aiRes.body; // Node stream

        stream.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;

                if (trimmed.startsWith('data: ') || (isAnthropic && trimmed.startsWith('event: content_block_delta'))) {
                    // Logic branch
                    if (isAnthropic) {
                        // Anthropic SSE format is complex (event line, then data line)
                        // Simplified parser for buffer handling might be needed, but assuming lines come clean:
                        // Actually Anthropic sends: `event: ...\ndata: ...`
                        // Checking `data:` line is safer.
                    }
                }

                // Simplified Parser Logic for both (Valid for ~95% cases)
                // We look for JSON objects in lines starting with 'data: ' (OpenAI) or just data in Anthropic flow

                let jsonStr = '';
                if (trimmed.startsWith('data: ')) {
                    jsonStr = trimmed.slice(6);
                } else if (isAnthropic && trimmed.startsWith('{')) {
                    // Sometimes just JSON lines? No, Anthropic is SSE.
                    // Let's rely on standard OpenAI logic first, handle Anthropic special if needed.
                    // Actually, let's keep it simple:
                    // If we fail to parse, ignore.
                }

                if (jsonStr) {
                    try {
                        const json = JSON.parse(jsonStr);
                        let text = '';

                        if (isAnthropic) {
                            if (json.type === 'content_block_delta' && json.delta && json.delta.text) {
                                text = json.delta.text;
                            }
                        } else {
                            // Handle DeepSeek R1 reasoning_content (thinking process)
                            if (json.choices && json.choices[0].delta) {
                                const delta = json.choices[0].delta;

                                // DeepSeek R1 returns reasoning in reasoning_content
                                if (delta.reasoning_content) {
                                    // Check if this is the start of reasoning
                                    if (!res.reasoningStarted) {
                                        res.reasoningStarted = true;
                                        text += '<think>';
                                    }
                                    text += delta.reasoning_content;
                                }

                                // Normal content - can exist in same delta as reasoning_content
                                if (delta.content) {
                                    // If we were in reasoning mode, close the think tag first
                                    if (res.reasoningStarted && !res.reasoningEnded) {
                                        res.reasoningEnded = true;
                                        text += '</think>';
                                    }
                                    text += delta.content;
                                }
                            }
                        }

                        if (text) {
                            res.write(`data: ${JSON.stringify({ text })}\n\n`);
                        }
                    } catch (e) { }
                }
            }
        });

        stream.on('end', () => {
            // Close think tag if still open (in case reasoning ended but no content followed)
            if (res.reasoningStarted && !res.reasoningEnded) {
                res.write(`data: ${JSON.stringify({ text: '</think>' })}\n\n`);
                // Add a message indicating content was not generated
                res.write(`data: ${JSON.stringify({ text: '\n\n> ⚠️ **提示**：AI完成了深度思考，但未能生成最终报告内容。这通常是因为思考过程过长，触发了Token限制。请尝试重新生成。' })}\n\n`);
                console.log('[Warning] Stream ended with only reasoning content, no final content was generated');
            }
            res.write('data: [DONE]\n\n');
            res.end();
        });

    } catch (e) {
        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        res.end();
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
        await streamAI(res, systemPrompt, content);
    } catch (error) {
        console.error("Generate daily error:", error);
        // Only verify if headers sent, but streamAI handles its own errors usually.
        if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
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

        // Strip thinking content before saving - only save final result
        const cleanReport = generatedReport
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .trim();

        const data = {
            date,
            weekday: new Date(date).toLocaleDateString('zh-CN', { weekday: 'long' }),
            rawContent,
            generatedReport: cleanReport, // Save clean version without thinking
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

        // Sort by date (Newest first for History UI)
        dailies.sort((a, b) => b.date.localeCompare(a.date));

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
        console.error("Generate weekly error:", error);
        if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
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

// Helper to recursively find all report files
async function findAllReports(dir) {
    let results = [];
    const list = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const dirent of list) {
        const res = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
            results = results.concat(await findAllReports(res));
        } else if (res.endsWith('.json') && !res.endsWith('config.json')) {
            results.push(res);
        }
    }
    return results;
}

// Global History API
app.get('/api/history', async (req, res) => {
    try {
        const { page = 1, limit = 10, type = 'all', keyword = '', startDate, endDate } = req.query;
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) return res.json({ items: [], total: 0 });

        const allFiles = await findAllReports(dataDir);
        let reports = [];

        // Read and parse files
        for (const file of allFiles) {
            try {
                const content = JSON.parse(await readFileAsync(file, 'utf8'));
                // Determine type based on file path or content structure
                // Weekly reports have 'weekNumber', Daily reports have 'weekday'
                const reportType = content.weekNumber ? 'weekly' : 'daily';

                // Filter by Type
                if (type !== 'all' && reportType !== type) continue;

                // Determine Date
                // Dailies have 'date'. Weeklies might rely on createdAt or we can try to extract from path
                let itemDate = content.date;
                if (!itemDate && content.createdAt) {
                    itemDate = content.createdAt.split('T')[0];
                }

                if (startDate && itemDate < startDate) continue;
                if (endDate && itemDate > endDate) continue;

                // Filter by Keyword
                if (keyword) {
                    const jsonStr = JSON.stringify(content).toLowerCase();
                    if (!jsonStr.includes(keyword.toLowerCase())) continue;
                }

                reports.push({
                    type: reportType,
                    date: itemDate,
                    weekday: content.weekday || '',
                    weekNumber: content.weekNumber || '',
                    preview: content.generatedReport ? removeThinkingContent(content.generatedReport).substring(0, 100) + '...' : '',
                    fullContent: content.generatedReport,
                    filePath: file
                });
            } catch (e) { }
        }

        // Sort desc
        reports.sort((a, b) => {
            const dateA = a.date || '';
            const dateB = b.date || '';
            return dateB.localeCompare(dateA);
        });

        // Paginate
        const total = reports.length;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedItems = reports.slice(startIndex, endIndex);

        res.json({
            items: paginatedItems,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Helper for removing thinking content (duplicated from logic needed here)
function removeThinkingContent(text) {
    return text ? text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() : '';
}

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
