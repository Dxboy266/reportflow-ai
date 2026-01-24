const API_BASE = '/api';

// UI Elements
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const dailyInput = document.getElementById('daily-input');
const dailyStyle = document.getElementById('daily-style');
const dailyOutput = document.getElementById('daily-output');
const dailyPreviewContainer = document.getElementById('daily-preview-container');

const weeklyStyle = document.getElementById('weekly-style');
const weeklyOutput = document.getElementById('weekly-output');
const weeklyPreviewContainer = document.getElementById('weekly-preview-container');

// const historyList = document.getElementById('history-list'); // Removed in enhanced version

// Settings Elements
const settingsModal = document.getElementById('settings-modal');
const closeModal = document.querySelector('.close-modal');
const btnSettings = document.getElementById('btn-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');

const providerSelect = document.getElementById('provider-select');
const apiBaseUrlInput = document.getElementById('api-base-url');
const modelNameInput = document.getElementById('model-name');
const apiKeyInput = document.getElementById('api-key');

// Buttons
const btnGenerateDaily = document.getElementById('btn-generate-daily');
const btnRegenerateDaily = document.getElementById('btn-regenerate-daily');
const btnSaveDaily = document.getElementById('btn-save-daily');
const btnGenerateWeekly = document.getElementById('btn-generate-weekly');
const btnRegenerateWeekly = document.getElementById('btn-regenerate-weekly');
const btnSaveWeekly = document.getElementById('btn-save-weekly');


// Provider Presets
const PROVIDERS = {
    'deepseek': {
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat'
    },
    'siliconflow': {
        baseUrl: 'https://api.siliconflow.cn/v1',
        model: 'deepseek-ai/DeepSeek-V3'
    },
    'openai': {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o'
    },
    'local': {
        baseUrl: 'http://localhost:11434/v1',
        model: 'llama3'
    },
    'antigravity': {
        baseUrl: 'http://127.0.0.1:8045',
        model: 'claude-opus-4-5-thinking'
    },
    'custom': {
        baseUrl: '',
        model: ''
    }
};

// State
let generatedDailyCache = null;
let generatedWeeklyCache = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadHistory();
    setupTabs();
    setupSettings();
});

// Tabs
function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-section`).classList.add('active');
        });
    });
}

function setupSettings() {
    // Open Modal
    btnSettings.addEventListener('click', () => {
        settingsModal.classList.add('show');
    });

    // Close Modal
    closeModal.addEventListener('click', () => settingsModal.classList.remove('show'));
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('show');
    });

    // Save
    btnSaveSettings.addEventListener('click', saveConfig);

    // Provider Change
    providerSelect.addEventListener('change', (e) => {
        const provider = e.target.value;
        const preset = PROVIDERS[provider];
        if (preset && provider !== 'custom') {
            apiBaseUrlInput.value = preset.baseUrl;
            modelNameInput.value = preset.model;
        }
    });
}

// Config
async function loadConfig() {
    try {
        const res = await fetch(`${API_BASE}/config`);
        const data = await res.json();
        const aiConfig = data.ai || {};

        // Fill settings form
        if (aiConfig.provider) providerSelect.value = aiConfig.provider;
        if (aiConfig.baseUrl) apiBaseUrlInput.value = aiConfig.baseUrl;
        if (aiConfig.model) modelNameInput.value = aiConfig.model;

        if (!aiConfig.hasApiKey) {
            // First time or missing key
            if (!localStorage.getItem('settingsShown')) {
                settingsModal.classList.add('show');
                localStorage.setItem('settingsShown', 'true');
            }
        }
    } catch (e) {
        console.error('Failed to load config', e);
    }
}

async function saveConfig() {
    const provider = providerSelect.value;
    const baseUrl = apiBaseUrlInput.value.trim();
    const model = modelNameInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!baseUrl || !model) return alert('请填写完整的 API 信息 (Base URL 和 Model)');

    // For cloud providers, API key is usually required. For local, it's not.
    if (!apiKey && provider !== 'local' && provider !== 'custom') {
        if (!confirm('您未填写 API Key，确定要保存吗？(本地模型通常不需要 Key)')) {
            return;
        }
    }

    setLoading(btnSaveSettings, true);

    const payload = {
        provider,
        baseUrl,
        model
    };
    if (apiKey !== null) payload.apiKey = apiKey;

    try {
        const res = await fetch(`${API_BASE}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            settingsModal.classList.remove('show');
            alert('配置已保存');
            apiKeyInput.value = ''; // Clear for security
            loadConfig(); // Reload to refresh state
        } else {
            alert('保存失败: ' + data.error);
        }
    } catch (e) {
        alert('保存失败');
    } finally {
        setLoading(btnSaveSettings, false);
    }
}

// Daily Generator
// Daily Generator
async function generateDaily(e) {
    const targetBtn = (e && e.currentTarget) ? e.currentTarget : btnGenerateDaily;
    const content = dailyInput.value.trim();
    const style = dailyStyle.value;

    if (!content) return alert('请输入今日工作内容');

    // Check if report already exists
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    console.log('[Debug] Checking daily existence for:', dateStr);
    try {
        const checkRes = await fetch(`${API_BASE}/check-exists?type=daily&date=${dateStr}`);
        const checkData = await checkRes.json();
        console.log('[Debug] Check response:', checkData);

        if (checkData.exists) {
            console.log('[Debug] Daily exists, prompting confirm...');
            const confirmed = await showConfirm('检测到今日日报已存在，是否继续生成？(后续保存将覆盖旧文件)');
            console.log('[Debug] Confirm result:', confirmed);
            if (!confirmed) return;
        }
    } catch (e) {
        console.warn('[Debug] Check exists failed', e);
    }

    setLoading(targetBtn, true, '日报生成中...');

    // Prevent double clicking the other button
    btnGenerateDaily.disabled = true;
    btnRegenerateDaily.disabled = true;

    // ★ 立即显示预览区域和加载状态 - 不要让用户干等！
    const renderEl = document.getElementById('daily-output-render');
    dailyPreviewContainer.style.display = 'block';
    renderEl.innerHTML = `
        <div class="thinking-box loading expanded">
            <div class="thinking-header">
                <span class="thinking-spinner"></span>
                <span class="thinking-status">AI 思考中...</span>
            </div>
            <div class="thinking-content">正在分析您的工作内容，请稍候...</div>
        </div>
    `;

    if (targetBtn === btnGenerateDaily) {
        dailyPreviewContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    try {
        const res = await fetch(`${API_BASE}/generate-daily`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, style })
        });

        let fullText = '';
        let thinkingStartTime = Date.now(); // 从请求开始计时
        let isThinking = false;
        let hasReceivedContent = false;

        await handleStream(res, (text) => {
            fullText += text;
            hasReceivedContent = true;

            // Track thinking state
            if (fullText.includes('<think>') && !isThinking) {
                isThinking = true;
            }
            if (fullText.includes('</think>')) {
                isThinking = false;
            }

            // Render with thinking support
            renderWithThinking(fullText, isThinking, thinkingStartTime, renderEl);
        });

        // Final render with completed state
        renderWithThinking(fullText, false, thinkingStartTime, renderEl);

        // Completion
        btnGenerateDaily.disabled = true;
        btnRegenerateDaily.disabled = false;

        generatedDailyCache = {
            rawContent: content,
            generatedReport: fullText,
            style: style
        };

    } catch (e) {
        alert('网络或生成错误: ' + e.message);
        btnGenerateDaily.disabled = false;
        btnRegenerateDaily.disabled = false;
    } finally {
        setLoading(targetBtn, false);
    }
}

// Stream Handler Helper
async function handleStream(response, onChunk) {
    if (!response.ok) throw new Error(await response.text());

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;

            if (trimmed.startsWith('data: ')) {
                try {
                    const data = JSON.parse(trimmed.slice(6));
                    if (data.text) onChunk(data.text);
                    if (data.error) throw new Error(data.error);
                } catch (e) { console.warn('Stream parse error', e); }
            }
        }
    }
}

// Build Thinking HTML with collapsible structure
function buildThinkingHtml(fullText, isThinking, startTime) {
    // Calculate thinking duration
    let durationText = '';
    if (startTime) {
        const seconds = Math.round((Date.now() - startTime) / 1000);
        durationText = `${seconds}秒`;
    }

    // Status classes and text
    const boxClass = isThinking ? 'thinking-box loading expanded' : 'thinking-box';
    const statusText = isThinking ? '深度思考中...' : '已深度思考';
    const spinnerHtml = '<span class="thinking-spinner"></span>';
    const completeIcon = '<span class="thinking-complete-icon">💭</span>';
    const durationHtml = durationText ? `<span class="thinking-duration">${durationText}</span>` : '';

    // Check if there's a think tag
    const thinkMatch = fullText.match(/<think>([\s\S]*?)(<\/think>|$)/);

    if (!thinkMatch) {
        // No thinking content, just return the text as-is for markdown parsing
        return { hasThinking: false, content: fullText };
    }

    const thinkContent = thinkMatch[1].trim();
    const hasEnded = thinkMatch[2] === '</think>';
    const currentBoxClass = hasEnded ? 'thinking-box' : boxClass;
    const currentStatus = hasEnded ? '已深度思考' : statusText;

    // Remove think tags from original text for clean content
    const cleanContent = fullText.replace(/<think>[\s\S]*?(<\/think>|$)/, '').trim();

    const thinkingBoxHtml = `<div class="${currentBoxClass}">
        <div class="thinking-header">
            ${spinnerHtml}${completeIcon}
            <span class="thinking-status">${currentStatus}</span>
            ${durationHtml}
        </div>
        <div class="thinking-content">${thinkContent.replace(/\n/g, '<br>')}</div>
    </div>`;

    return {
        hasThinking: true,
        thinkingHtml: thinkingBoxHtml,
        content: cleanContent
    };
}

// Render with thinking support
function renderWithThinking(fullText, isThinking, startTime, renderEl) {
    const result = buildThinkingHtml(fullText, isThinking, startTime);

    if (result.hasThinking) {
        // Render thinking box first, then markdown content
        let contentHtml = '';
        if (result.content && result.content.trim()) {
            contentHtml = marked.parse(result.content);
        } else if (!isThinking) {
            // If finished thinking but no content, show a message
            contentHtml = '<p style="color: #888; padding: 16px;">⚠️ AI 完成思考但未生成报告内容。可能是：<br>1. 模型响应被截断<br>2. Token 限制已达到<br>请尝试重新生成。</p>';
        }
        renderEl.innerHTML = result.thinkingHtml + contentHtml;
    } else {
        // No thinking, just render markdown
        renderEl.innerHTML = marked.parse(result.content);
    }

    // Attach click handlers for thinking toggle
    attachThinkingToggleHandlers(renderEl);
}

// Attach click handlers for thinking box toggle
function attachThinkingToggleHandlers(container) {
    const thinkingBoxes = container.querySelectorAll('.thinking-box:not(.loading)');
    thinkingBoxes.forEach(box => {
        const header = box.querySelector('.thinking-header');
        if (header && !header.dataset.handlerAttached) {
            header.dataset.handlerAttached = 'true';
            header.addEventListener('click', () => {
                box.classList.toggle('expanded');
            });
        }
    });
}


async function saveDaily() {
    if (!generatedDailyCache) return;

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = date.getDay(); // 0=Sunday, 5=Friday, 6=Saturday

    try {
        const res = await fetch(`${API_BASE}/save-daily`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: dateStr,
                ...generatedDailyCache
            })
        });

        const data = await res.json();
        if (data.success) {
            // Copy to clipboard (without thinking content)
            const cleanReport = removeThinkingContent(generatedDailyCache.generatedReport);
            await copyToClipboard(cleanReport);
            showToast('✅ 日报已保存并复制到剪贴板！');

            // Reset UI
            dailyPreviewContainer.style.display = 'none';
            dailyInput.value = '';
            btnGenerateDaily.disabled = false; // Re-enable
            generatedDailyCache = null;
            btnGenerateDaily.disabled = false; // Re-enable
            generatedDailyCache = null;
            fetchDailyHistory(); // Refresh daily list

            // Smart Weekly Report Prompt on Friday/Saturday
            if (dayOfWeek === 5 || dayOfWeek === 6) {
                const dayName = dayOfWeek === 5 ? '周五' : '周六';
                const shouldGenerate = await showConfirm(
                    `今天是${dayName}，日报已保存成功！\n是否继续生成本周周报？`
                );
                if (shouldGenerate) {
                    // Switch to weekly tab and trigger generation
                    switchToWeeklyTab();
                    setTimeout(() => {
                        generateWeekly();
                    }, 300);
                }
            }
        } else {
            alert('保存失败: ' + data.error);
        }
    } catch (e) {
        alert('保存失败');
    }
}

// Switch to weekly report tab
function switchToWeeklyTab() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const weeklyTabBtn = document.querySelector('.tab-btn[data-tab="weekly"]') ||
        document.querySelectorAll('.tab-btn')[1]; // Fallback to 2nd tab
    const weeklySection = document.getElementById('weekly-section');

    if (weeklyTabBtn) weeklyTabBtn.classList.add('active');
    if (weeklySection) weeklySection.classList.add('active');
}

// Weekly Generator
async function generateWeekly(e) {
    const targetBtn = (e && e.currentTarget) ? e.currentTarget : btnGenerateWeekly;
    const style = weeklyStyle.value;

    // Check if weekly report already exists
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    try {
        const checkRes = await fetch(`${API_BASE}/check-exists?type=weekly&date=${dateStr}`);
        const checkData = await checkRes.json();

        if (checkData.exists) {
            if (!await showConfirm('检测到本周周报已存在，是否继续生成？(后续保存将覆盖旧文件)')) {
                return;
            }
        }
    } catch (e) {
        console.warn('Check exists failed', e);
    }

    setLoading(targetBtn, true, '周报生成中...');

    // ★ 立即显示预览区域和加载状态
    const renderEl = document.getElementById('weekly-output-render');
    weeklyPreviewContainer.style.display = 'block';
    renderEl.innerHTML = `
        <div class="thinking-box loading expanded">
            <div class="thinking-header">
                <span class="thinking-spinner"></span>
                <span class="thinking-status">AI 思考中...</span>
            </div>
            <div class="thinking-content">正在汇总本周日报，生成周报...</div>
        </div>
    `;

    try {
        const res = await fetch(`${API_BASE}/generate-weekly`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ style })
        });

        let fullText = '';
        let thinkingStartTime = Date.now();
        let isThinking = false;

        await handleStream(res, (text) => {
            fullText += text;

            // Track thinking state
            if (fullText.includes('<think>') && !isThinking) {
                isThinking = true;
            }
            if (fullText.includes('</think>')) {
                isThinking = false;
            }

            // Render with thinking support
            renderWithThinking(fullText, isThinking, thinkingStartTime, renderEl);
        });

        // Final render with completed state
        renderWithThinking(fullText, false, thinkingStartTime, renderEl);

        generatedWeeklyCache = {
            generatedReport: fullText,
            style: style
        };

    } catch (e) {
        alert('网络或生成错误: ' + e.message);
    } finally {
        setLoading(targetBtn, false);
    }
}

async function saveWeekly() {
    if (!generatedWeeklyCache) return;

    try {
        // Strip thinking content before saving
        const cleanReport = removeThinkingContent(generatedWeeklyCache.generatedReport);

        const res = await fetch(`${API_BASE}/save-weekly`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...generatedWeeklyCache,
                generatedReport: cleanReport // Send clean version
            })
        });

        const data = await res.json();
        if (data.success) {
            // Copy to clipboard (clean version)
            await copyToClipboard(cleanReport);
            showToast('✅ 周报已保存并复制到剪贴板！');

            weeklyPreviewContainer.style.display = 'none';
            generatedWeeklyCache = null;
            fetchWeeklyHistory(); // Refresh weekly list
        } else {
            showToast('❌ 保存失败: ' + data.error);
        }
    } catch (e) {
        showToast('❌ 保存失败');
    }
}

// --- Advanced History Logic ---

// const HISTORY_PAGE_SIZE = 8; // Removed, now dynamic

// Initial state
const historyState = {
    daily: { page: 1, totalPages: 1 },
    weekly: { page: 1, totalPages: 1 }
};

// Helper: Strip Markdown for cleaner preview
function stripMarkdown(text) {
    if (!text) return '';
    // Remove headers
    text = text.replace(/^#+\s+/gm, '');
    // Remove bold/italic
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');
    // Remove lists
    text = text.replace(/^[\s-]*[-+*]\s+/gm, '');
    // Remove links
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    return text.trim();
}

// Generic Fetch Function for Tabbed History
async function fetchSpecificHistory(type, page = 1) {
    historyState[type].page = page;

    const startDate = document.getElementById(`${type}-start-date`).value;
    const endDate = document.getElementById(`${type}-end-date`).value;
    const keyword = document.getElementById(`${type}-keyword`).value;

    // Dynamic Limit
    const limitSelect = document.getElementById(`${type}-limit`);
    const limit = limitSelect ? parseInt(limitSelect.value) : 5;

    const query = new URLSearchParams({
        page,
        limit,
        type,
        keyword,
        startDate,
        endDate
    });

    try {
        const res = await fetch(`${API_BASE}/history?${query}`);
        const data = await res.json();

        historyState[type].totalPages = data.totalPages;

        renderHistoryGrid(data.items, `${type}-history-container`);
        renderSpecificPagination(type, data.page, data.totalPages);
    } catch (e) { console.error(e); }
}

// wrappers
const fetchDailyHistory = () => fetchSpecificHistory('daily', historyState.daily.page);
const fetchWeeklyHistory = () => fetchSpecificHistory('weekly', historyState.weekly.page);

// Render Grid / List based on type
function renderHistoryGrid(items, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="history-empty">在此范围内暂无记录</div>';
        return;
    }

    // Determine layout mode based on container ID 
    const isWeekly = containerId.includes('weekly');

    if (isWeekly) {
        container.className = 'history-list-mode'; // Switch to List Mode
        renderWeeklyListMode(items, container);
    } else {
        container.className = 'history-grid-container'; // Keep Grid Mode
        renderDailyGridMode(items, container);
    }
}

// --- Daily Renderer (Card Grid) ---
function renderDailyGridMode(items, container) {
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-card';

        let contentRaw = item.fullContent || item.preview || '';
        contentRaw = removeThinkingContent(contentRaw);
        const smartTitle = extractSmartTitle(contentRaw);

        // Safe encode for onclick
        const safeDate = item.date;
        const safeContent = encodeURIComponent(item.fullContent || '');

        card.onclick = () => viewHistoryItem(safeDate, safeContent, 'daily');

        card.innerHTML = `
            <div class="history-card-header">
                <span class="history-date">${item.date}</span>
                <span class="badge badge-daily">${item.weekday}</span>
            </div>
            <div class="history-preview-minimal">
                ${smartTitle}
            </div>
        `;
        container.appendChild(card);
    });
}

// --- Weekly Renderer (Wide List) ---
// --- Weekly Renderer (Wide Dashboard Mode) ---
function renderWeeklyListMode(items, container) {
    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'history-list-card'; // Wide card

        // 1. Clean Thinking Content First
        let contentRaw = item.fullContent || item.preview || '';
        contentRaw = removeThinkingContent(contentRaw);

        // 2. Extract The "Core Summary" Section (Rich HTML)
        const summaryHtml = extractWeeklyCoreContent_V2(contentRaw);

        // Safe encode
        const safeDate = item.date;
        const safeContent = encodeURIComponent(item.fullContent || '');

        // Pass 'weekly' type explicitly to fix Modal Title
        const openAction = () => viewHistoryItem(safeDate, safeContent, 'weekly');

        row.innerHTML = `
            <div class="list-date-group">
                <span class="history-date">${item.date}</span>
                <span class="list-week-badge">第${item.weekNumber}周</span>
            </div>
            <!-- Expanded Summary Area -->
            <div class="list-summary-expanded">
                ${summaryHtml}
            </div>
            <div class="list-action">
                <button class="btn-view-details" title="查看完整周报">📜 详情</button>
            </div>
        `;

        row.querySelector('.btn-view-details').onclick = (e) => {
            e.stopPropagation();
            openAction();
        };
        row.onclick = openAction;

        container.appendChild(row);
    });
}

// Helper: Extract Smart Title (For Daily) - Keep existing logic
function extractSmartTitle(markdown) {
    // ... (Use previous optimized logic if possible, or just re-declare minimally here)
    // Actually, let's reuse the one we wrote before, or paste it here to be safe.
    if (!markdown) return '无内容';
    let title = '';
    const subjectMatch = markdown.match(/(?:邮件主题|Subject|主题|Title).*?[：:]\s*(.*)/i);
    if (subjectMatch) title = subjectMatch[1];
    else {
        const boldMatch = markdown.match(/\*\*(.*?)\*\*/);
        if (boldMatch) title = boldMatch[1];
    }
    if (!title) {
        const headerMatch = markdown.match(/^#+\s+(.*)/m);
        if (headerMatch && !/工作明细|今日|Summary/i.test(headerMatch[1])) title = headerMatch[1];
    }
    if (title) return title.replace(/[\*_~`]/g, '').split(/[-——]/).pop().trim();
    return '无标题';
}

// Helper: Extract Weekly Core Content (HTML)
function extractWeeklyCoreContent(markdown) {
    if (!markdown) return '<span style="color:var(--text-secondary)">无内容</span>';

    // Strategy: 
    // 1. Find the section "一、...产出" or "Key Results"
    // 2. Capture everything until the next Header (e.g. "二、...")
    // 3. Convert that subset to HTML using marked

    // Normalize newlines
    const text = markdown.replace(/\r\n/g, '\n');

    // Try to find start of "Work Output" section
    let startIndex = 0;
    const startMatch = text.match(/^(#+\s*|[一二三四五]、|\d+\.\s*)(本周|重点|工作|核心|Key|Core).*/m);
    if (startMatch) {
        startIndex = startMatch.index + startMatch[0].length;
    }

    // Capture content after start
    let coreSection = text.substring(startIndex);

    // Find stop point (Next Header or Section)
    const endMatch = coreSection.match(/\n(#+\s*|[一二三四五]、|\d+\.\s*)(下周|计划|问题|Next|Plan).*/);
    if (endMatch) {
        coreSection = coreSection.substring(0, endMatch.index);
    }

    // Parse to HTML
    if (window.marked) {
        return marked.parse(coreSection);
    }
    return coreSection;
}


// Helper: Extract Weekly Core Content V2 (HTML) - Prefer "Personal Summary"
function extractWeeklyCoreContent_V2(markdown) {
    if (!markdown) return '<span style="color:var(--text-secondary)">无内容</span>';

    // Normalize newlines
    const text = markdown.replace(/\r\n/g, '\n');

    let startIndex = -1;

    // 1. Priority: Find "Personal Summary" / "总结" section
    const summaryMatch = text.match(/^(?:#+\s*)?(?:[一二三四五]、|\d+\.\s*)?(?:个人总结|总结|Summary|Conclusion|Personal Summary).*/m);
    if (summaryMatch) {
        startIndex = summaryMatch.index + summaryMatch[0].length;
    }

    // 2. Fallback: Find "Work Output" / "重点工作" if no summary
    if (startIndex === -1) {
        const backupMatch = text.match(/^(?:#+\s*|[一二三四五]、|\d+\.\s*)(?:本周|重点|工作|核心|Key|Core).*/m);
        if (backupMatch) {
            startIndex = backupMatch.index + backupMatch[0].length;
        }
    }

    // Capture content
    let coreSection = startIndex !== -1 ? text.substring(startIndex) : text;

    // 3. Stop at Next Header
    const nextHeaderMatch = coreSection.match(/\n(?:#+\s*|[一二三四五]、|\d+\.\s*)(?:下周|计划|问题|参考|Next|Plan).*/);
    if (nextHeaderMatch) {
        coreSection = coreSection.substring(0, nextHeaderMatch.index);
    }

    // Parse to HTML
    if (window.marked) {
        return marked.parse(coreSection);
    }
    return coreSection;
}

// Render Pagination for Specific Tab
function renderSpecificPagination(type, currentPage, totalPages) {
    const container = document.getElementById(`${type}-pagination`);
    if (!container) return;
    container.innerHTML = '';

    // Always show pagination container if we have pages, or if empty? 
    // Actually, if totalPages <= 1, maybe hide buttons but show info? 
    // Let's keep it simple: if <= 1, hide.
    if (totalPages <= 1) return;

    // Prev
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '&lt;';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => fetchSpecificHistory(type, currentPage - 1);
    container.appendChild(prevBtn);

    // Info
    const pageInfo = document.createElement('span');
    pageInfo.style.color = 'var(--text-secondary)';
    pageInfo.style.margin = '0 10px';
    pageInfo.innerText = `${currentPage} / ${totalPages}`;
    container.appendChild(pageInfo);

    // Next
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '&gt;';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => fetchSpecificHistory(type, currentPage + 1);
    container.appendChild(nextBtn);
}

// Global scope for onclick access (Fixing Type Parameter)
window.viewHistoryItem = (date, encodedContent, type = 'daily') => {
    const content = decodeURIComponent(encodedContent);
    openReportModal(date, content, type);
};

// Helper: Get Date String (YYYY-MM-DD)
function getDateString(daysAgo = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
}

// Bind History Events and Init
document.addEventListener('DOMContentLoaded', () => {
    // Set Default Dates
    // Daily: Past 7 days
    const dailyStart = document.getElementById('daily-start-date');
    if (dailyStart) dailyStart.value = getDateString(7);
    const dailyEnd = document.getElementById('daily-end-date');
    if (dailyEnd) dailyEnd.value = getDateString(0);

    // Weekly: Past 30 days
    const weeklyStart = document.getElementById('weekly-start-date');
    if (weeklyStart) weeklyStart.value = getDateString(30);
    const weeklyEnd = document.getElementById('weekly-end-date');
    if (weeklyEnd) weeklyEnd.value = getDateString(0);

    // Bind Search Buttons
    const btnSearchDaily = document.getElementById('btn-search-daily');
    if (btnSearchDaily) btnSearchDaily.addEventListener('click', () => fetchSpecificHistory('daily', 1));

    const btnSearchWeekly = document.getElementById('btn-search-weekly');
    if (btnSearchWeekly) btnSearchWeekly.addEventListener('click', () => fetchSpecificHistory('weekly', 1));

    // Bind Enter Key for Search Inputs
    const dailySearchInput = document.getElementById('daily-keyword');
    if (dailySearchInput) {
        dailySearchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') fetchSpecificHistory('daily', 1);
        });
    }

    const weeklySearchInput = document.getElementById('weekly-keyword');
    if (weeklySearchInput) {
        weeklySearchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') fetchSpecificHistory('weekly', 1);
        });
    }

    // Bind Limit Selectors
    const dailyLimit = document.getElementById('daily-limit');
    if (dailyLimit) dailyLimit.addEventListener('change', () => fetchSpecificHistory('daily', 1));

    const weeklyLimit = document.getElementById('weekly-limit');
    if (weeklyLimit) weeklyLimit.addEventListener('change', () => fetchSpecificHistory('weekly', 1));

    // Initial Load
    fetchDailyHistory();
    fetchWeeklyHistory();
});

// Alias for compatibility
window.loadHistory = () => fetchDailyHistory();

// Report Modal Logic
const reportModal = document.getElementById('report-modal');
const closeReportModalBtn = document.querySelector('.close-report-modal');
const reportModalTitle = document.getElementById('report-modal-title');
const reportModalBody = document.getElementById('report-modal-body');
const btnCopyReport = document.getElementById('btn-copy-report');

function openReportModal(date, content, type = 'daily') {
    // Dynamic Title
    const titleSuffix = type === 'weekly' ? '周报详情' : '日报详情';
    if (reportModalTitle) reportModalTitle.textContent = `${date} ${titleSuffix}`;

    // Force clean thinking content
    const cleanContent = removeThinkingContent(content);

    // Render
    if (window.marked) {
        if (reportModalBody) reportModalBody.innerHTML = marked.parse(cleanContent);
    } else {
        if (reportModalBody) reportModalBody.innerText = cleanContent;
    }

    if (reportModal) reportModal.classList.add('show');


    // Setup copy button (without thinking content)
    btnCopyReport.onclick = () => {
        const cleanContent = removeThinkingContent(content);
        copyToClipboard(cleanContent);
        showToast('内容已复制（不含思考过程）');
    };
}

closeReportModalBtn.onclick = () => reportModal.classList.remove('show');
window.addEventListener('click', (e) => {
    if (e.target === reportModal) reportModal.classList.remove('show');
    // Also close confirm modal if clicked outside? Maybe safer to force button choice for confirm.
    // Let's allow outside click to cancel too.
    if (e.target === confirmModal) {
        confirmModal.classList.remove('show');
        // We can't easily resolve the promise false here unless we expose the reject/resolve. 
        // For simplicity, let's keep confirm modal blocking (user must click buttons).
    }
});

// Custom Confirm Modal Logic
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
const btnOkConfirm = document.getElementById('btn-ok-confirm');

function showConfirm(message) {
    return new Promise((resolve) => {
        confirmMessage.textContent = message;
        confirmModal.classList.add('show');

        const cleanup = () => {
            confirmModal.classList.remove('show');
            btnOkConfirm.removeEventListener('click', handleOk);
            btnCancelConfirm.removeEventListener('click', handleCancel);
        };

        const handleOk = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        btnOkConfirm.addEventListener('click', handleOk);
        btnCancelConfirm.addEventListener('click', handleCancel);
    });
}

// Utils
function setLoading(btn, isLoading, customText = '生成中...') {
    if (isLoading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerHTML = `<span class="spinner">⏳</span> ${customText}`;
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'wait';
    } else {
        btn.innerText = btn.dataset.originalText || btn.innerText;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
}

// Remove thinking content from text (for copying/saving)
function removeThinkingContent(text) {
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

// Toast Notification
function showToast(message, duration = 3000) {
    // Remove existing toast if any
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Hide after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Events
btnGenerateDaily.addEventListener('click', generateDaily);
btnRegenerateDaily.addEventListener('click', generateDaily);
btnSaveDaily.addEventListener('click', saveDaily);

btnGenerateWeekly.addEventListener('click', generateWeekly);
btnRegenerateWeekly.addEventListener('click', generateWeekly);
btnSaveWeekly.addEventListener('click', saveWeekly);
