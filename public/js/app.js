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

// Edit Mode State
let dailyEditMode = false;
let weeklyEditMode = false;

// Role Selectors
const dailyRole = document.getElementById('daily-role');
const weeklyRole = document.getElementById('weekly-role');

// Edit Mode Elements
const btnEditDaily = document.getElementById('btn-edit-daily');
const btnEditWeekly = document.getElementById('btn-edit-weekly');
const dailyEditTextarea = document.getElementById('daily-edit-textarea');
const weeklyEditTextarea = document.getElementById('weekly-edit-textarea');
const dailyOutputRender = document.getElementById('daily-output-render');
const weeklyOutputRender = document.getElementById('weekly-output-render');
const dailyCharCounter = document.getElementById('daily-char-counter');
const weeklyCharCounter = document.getElementById('weekly-char-counter');

// Init
// Init
// Init
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();

    // Force set defaults on init
    setSmartDates('daily');
    setSmartDates('weekly');

    // Load Data
    loadHistory();
    fetchWeeklyHistory();

    setupTabs();
    setupSettings();
});

// Helper: Smart Date Setter
function setSmartDates(type) {
    const startInput = document.getElementById(`${type}-start-date`);
    const endInput = document.getElementById(`${type}-end-date`);
    if (!startInput || !endInput) return;

    let startStr, endStr;

    const now = new Date();

    if (type === 'daily') {
        // Daily: Always Mon-Fri of CURRENT week
        // Note: In JS getDay(), Sunday is 0. We treat Monday as 1.
        let day = now.getDay();
        // If Sunday(0), treat as 7 to calculate back to Monday easily if we consider Sun as end of week
        // Standard ISO week: Mon=1, Sun=7.
        // Diff to Monday: 1 - day.
        // If today is Sun(0), ISO day is 7. Diff = 1 - 7 = -6.
        // If today is Mon(1), ISO day is 1. Diff = 1 - 1 = 0.

        const isoDay = day === 0 ? 7 : day;
        const diffToMon = 1 - isoDay;

        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMon);

        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        startStr = formatDateFull(monday);
        endStr = formatDateFull(friday);
    } else {
        // Weekly: First Day of Month to Last Day of Month
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Day 0 of next month

        startStr = formatDateFull(firstDay);
        endStr = formatDateFull(lastDay);
    }

    startInput.value = startStr;
    endInput.value = endStr;
}

// Helper: Date Formatter
function formatDateFull(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Tabs Logic
function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const type = tab.dataset.tab; // 'daily' or 'weekly'
            document.getElementById(`${type}-section`).classList.add('active');

            // STRICT: Reset dates to default range when switching (User preference)
            // Or just verify they are set. Let's force reset to ensure "Default is..." behavior
            setSmartDates(type);

            // Refresh data
            if (type === 'daily') fetchDailyHistory();
            if (type === 'weekly') fetchWeeklyHistory();
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

    // Change Data Path
    const btnChangePath = document.getElementById('btn-change-path');
    if (btnChangePath) {
        btnChangePath.addEventListener('click', async () => {
            try {
                // Show loading state?
                btnChangePath.textContent = '选择中...';
                const res = await fetch(`${API_BASE}/config/select-path`, { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    document.getElementById('data-path-display').value = data.path;
                    showToast('✅ 路径已更新，请重启应用生效');
                } else if (data.cancelled) {
                    // Do nothing
                } else {
                    showToast('❌ ' + (data.error || '操作失败'));
                }
            } catch (e) {
                console.error(e);
                showToast('⚠️ 此功能仅支持桌面版');
            } finally {
                btnChangePath.textContent = '更改目录';
            }
        });
    }
    // Toggle API Key Visibility
    const btnToggleKey = document.getElementById('btn-toggle-key');
    if (btnToggleKey) {
        btnToggleKey.addEventListener('click', () => {
            const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
            apiKeyInput.setAttribute('type', type);
            // Toggle Icon (Simple Emoji switch for now, can be SVG)
            btnToggleKey.textContent = type === 'password' ? '👁️' : '🔒';
        });
    }
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

        // Fill data path
        if (data.currentDataPath) {
            const pathDisplay = document.getElementById('data-path-display');
            if (pathDisplay) pathDisplay.value = data.currentDataPath;
        }

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

    if (!baseUrl || !model) { await showAlert('请填写完整的 API 信息 (Base URL 和 Model)'); return; }

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
            await showAlert('配置已保存');
            apiKeyInput.value = ''; // Clear for security
            loadConfig(); // Reload to refresh state
        } else {
            await showAlert('保存失败: ' + data.error);
        }
    } catch (e) {
        await showAlert('保存失败');
    } finally {
        setLoading(btnSaveSettings, false);
    }
}

// Daily Generator
// Daily Generator
// Daily Generator
async function generateDaily(e) {
    const apiBase = apiBaseUrlInput.value.trim();
    const modelName = modelNameInput.value.trim();
    if (!apiBase || !modelName) {
        // await showAlert('请先配置 API 信息 (点击右上角设置图标)');
        // Improved UX: Direct user to settings
        if (confirm('⚠️ 未检测到 API 配置。\n\n需要配置 AI 模型信息才能生成内容。\n是否立即前往配置？')) {
            settingsModal.classList.add('show');
        }
        return;
    }
    const targetBtn = (e && e.currentTarget) ? e.currentTarget : btnGenerateDaily;
    const content = dailyInput.value.trim();
    const style = dailyStyle.value;
    const role = dailyRole ? dailyRole.value : '通用';

    // Reset edit mode
    dailyEditMode = false;
    if (btnEditDaily) updateEditButtonState('daily', false);

    if (!content) { await showAlert('请输入今日工作内容'); return; }

    // Minimum length check
    if (content.length < 10) {
        await showAlert('输入内容过少 (至少10个字符)，无法生成有效的日报。\n建议包含具体任务名称或进度。');
        return;
    }

    // Pure number check (e.g. "123")
    if (/^\d+$/.test(content)) {
        await showAlert('请输入具体的文字描述，而不仅仅是数字。');
        return;
    }

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
    // Hide buttons while generating
    dailyPreviewContainer.querySelector('.action-buttons').style.display = 'none';

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
            body: JSON.stringify({ content, style, role })
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
            style: style,
            role: role
        };

        // Show buttons after completion
        dailyPreviewContainer.querySelector('.action-buttons').style.display = 'flex';

    } catch (e) {
        await showAlert('网络或生成错误: ' + e.message);
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
            await showAlert('保存失败: ' + data.error);
        }
    } catch (e) {
        await showAlert('保存失败');
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
    const apiBase = apiBaseUrlInput.value.trim();
    const modelName = modelNameInput.value.trim();
    if (!apiBase || !modelName) {
        if (confirm('⚠️ 未检测到 API 配置。\n\n需要配置 AI 模型信息才能生成内容。\n是否立即前往配置？')) {
            settingsModal.classList.add('show');
        }
        return;
    }
    const targetBtn = (e && e.currentTarget) ? e.currentTarget : btnGenerateWeekly;
    const style = weeklyStyle.value;
    const role = weeklyRole ? weeklyRole.value : '通用';

    // Reset edit mode
    weeklyEditMode = false;
    if (btnEditWeekly) updateEditButtonState('weekly', false);

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
    // Hide buttons while generating
    weeklyPreviewContainer.querySelector('.action-buttons').style.display = 'none';

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
            body: JSON.stringify({ style, role })
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
            style: style,
            role: role
        };

        // Show buttons after completion
        weeklyPreviewContainer.querySelector('.action-buttons').style.display = 'flex';

    } catch (e) {
        // Parse error message if it's JSON
        let errorMsg = e.message;
        try {
            const jsonErr = JSON.parse(errorMsg);
            if (jsonErr.error) errorMsg = jsonErr.error;
        } catch (_) { }

        if (errorMsg.includes('No dailies found')) {
            await showAlert('⚠️ 本周暂无日报记录，无法生成周报。\n请先补充每日工作内容。');
        } else {
            await showAlert('网络或生成错误: ' + errorMsg);
        }
        // Hide preview if failed
        weeklyPreviewContainer.style.display = 'none';

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

        // Safe defaults for empty data
        const currentPage = data.page || 1;
        const totalPages = data.totalPages || 1;
        historyState[type].totalPages = totalPages;

        renderHistoryGrid(data.items, `${type}-history-container`);
        renderSpecificPagination(type, currentPage, totalPages);
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
        // Switch to centered layout for empty state
        container.classList.add('is-empty');
        // Modern Empty State HTML
        container.innerHTML = `
            <div class="modern-empty-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 200 200" style="width: 120px; height: 120px;">
                        <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(139,92,246,0.2)" stroke-width="2" stroke-dasharray="5,5"/>
                        <path d="M70 90 L130 90 M70 110 L110 110 M70 130 L120 130" stroke="rgba(139,92,246,0.3)" stroke-width="3" stroke-linecap="round"/>
                        <circle cx="100" cy="100" r="65" fill="rgba(139,92,246,0.05)"/>
                    </svg>
                </div>
                <div class="empty-title">暂无数据</div>
                <div class="empty-desc">当前时间范围内未找到任何记录</div>
                <div class="empty-hint">💡 提示：尝试调整日期范围或清空关键词搜索</div>
            </div>
        `;
        return;
    }

    // Remove empty class if data exists
    container.classList.remove('is-empty');

    // Determine layout mode based on container ID 
    const isWeekly = containerId.includes('weekly');

    // Robust Single Item check
    if (items.length === 1) {
        container.classList.add('single-item-mode');
    } else {
        container.classList.remove('single-item-mode');
    }

    // Unified Grid Renderer Call
    const type = isWeekly ? 'weekly' : 'daily';
    renderUnifiedGrid(items, container, type);
}

// --- Unified Card Renderer (The Ultimate Refactor) ---
function renderUnifiedGrid(items, container, type) {
    items.forEach(item => {
        const card = document.createElement('div');
        // Base class + Type Modifier
        card.className = `history-card card-${type}`;

        let contentRaw = item.fullContent || item.preview || '';
        contentRaw = removeThinkingContent(contentRaw);

        // --- Content Strategy Based on Type ---
        let bodyHtml = '';
        let badgeHtml = '';
        let metaHtml = '';

        if (type === 'daily') {
            const title = extractSmartTitle(contentRaw);
            bodyHtml = `<div class="card-brief-title" style="font-size:0.95rem; line-height:1.5; color:#e2e8f0;">${title}</div>`;
            badgeHtml = `<span class="badge badge-daily">${item.weekday}</span>`;
            metaHtml = '<span style="opacity:0.6; font-size:0.8rem;">日常记录</span>';
        }
        else if (type === 'weekly') {
            const highlights = extractWeeklyHighlights(contentRaw); // Ensure this is defined locally or below
            bodyHtml = `<div class="card-highlights">${highlights}</div>`;
            badgeHtml = `<span class="list-week-badge" style="background:rgba(139,92,246,0.15); border-color:rgba(139,92,246,0.3); color:#a78bfa;">第${item.weekNumber}周</span>`;
            metaHtml = `<span style="opacity:0.6; font-size:0.8rem;">📝 ${contentRaw.length}字</span>`;
        }

        // Safe encode
        const safeDate = item.date;
        const safeContent = encodeURIComponent(item.fullContent || '');
        const openAction = () => viewHistoryItem(safeDate, safeContent, type);

        card.onclick = openAction;

        // Unified Structure
        card.innerHTML = `
            <div class="history-card-header" style="justify-content:space-between; display:flex; margin-bottom:12px;">
                 <span class="history-date">${item.date}</span>
                 ${badgeHtml}
            </div>
            
            <div class="card-body" style="flex:1; margin-bottom:12px;">
                ${bodyHtml}
            </div>
            
            <div class="weekly-card-footer" style="margin-top:auto; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between;">
                ${metaHtml}
                <span style="color:${type === 'daily' ? '#3b82f6' : '#8b5cf6'}; font-size:0.85rem;">查看 ➜</span>
            </div>
        `;

        container.appendChild(card);
    });
}

// Add the missing helper function directly here to be safe
function extractWeeklyHighlights(markdown) {
    if (!markdown) return '暂无摘要';
    const lines = markdown.split('\n');
    const highlights = [];
    for (const line of lines) {
        const clean = line.trim();
        if (clean.length < 5 || clean.startsWith('#') || clean.startsWith('---')) continue;
        if (/^[-*]\s/.test(clean) || /^\d+\.\s/.test(clean)) {
            let text = clean.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').replace(/\*\*/g, '');
            if (text.length > 40) text = text.substring(0, 38) + '...';
            highlights.push(text);
        }
        if (highlights.length >= 3) break;
    }
    if (highlights.length === 0) return '点击查看详情';
    return `<ul style="padding-left:0; list-style:none; margin:0;">${highlights.map(h => `<li style="margin-bottom:6px; font-size:0.85rem; color:rgba(255,255,255,0.7); display:flex; align-items:flex-start; gap:6px;"><span style="color:#8b5cf6; font-size:1.2em; line-height:1;">•</span> ${h}</li>`).join('')}</ul>`;
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

    // Init Custom Selects
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const options = wrapper.querySelectorAll('.custom-option');
        const hiddenSelect = wrapper.querySelector('select');
        const selectedText = wrapper.querySelector('.selected-text');

        // Toggle
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close others
            document.querySelectorAll('.custom-select-wrapper').forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });
            wrapper.classList.toggle('open');
        });

        // Option Click
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                // UI Update
                options.forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                selectedText.textContent = option.textContent;

                // Value Sync
                const value = option.dataset.value;
                if (hiddenSelect) {
                    hiddenSelect.value = value;
                    // Auto-refresh for limit selectors
                    if (hiddenSelect.id === 'daily-limit') fetchDailyHistory();
                    if (hiddenSelect.id === 'weekly-limit') fetchWeeklyHistory();
                }

                wrapper.classList.remove('open');
            });
        });
    });

    // Close on click outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
    });
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

function showAlert(message) {
    return new Promise((resolve) => {
        confirmMessage.textContent = message;
        // Hide cancel button for alert
        btnCancelConfirm.style.display = 'none';
        confirmModal.classList.add('show');

        const cleanup = () => {
            confirmModal.classList.remove('show');
            btnOkConfirm.removeEventListener('click', handleOk);
            // Restore cancel button for next time
            setTimeout(() => { btnCancelConfirm.style.display = ''; }, 300);
        };

        const handleOk = () => {
            cleanup();
            resolve();
        };

        btnOkConfirm.addEventListener('click', handleOk);
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
btnGenerateWeekly.addEventListener('click', generateWeekly);
btnRegenerateWeekly.addEventListener('click', generateWeekly);
btnSaveWeekly.addEventListener('click', saveWeekly);

// Add listeners for search/filter inputs to auto-refresh or using button
document.getElementById('btn-search-daily').addEventListener('click', fetchDailyHistory);
document.getElementById('btn-search-weekly').addEventListener('click', fetchWeeklyHistory);

// Also support Enter key in search
document.getElementById('daily-keyword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchDailyHistory();
});
document.getElementById('weekly-keyword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchWeeklyHistory();
});


/* --- Custom Date Picker Class --- */
class CustomDatePicker {
    constructor() {
        this.popup = null;
        this.currentInput = null;
        this.currentDate = new Date();
        this.init();
    }

    init() {
        // Create Popup HTML
        this.popup = document.createElement('div');
        this.popup.className = 'calendar-popup';
        this.popup.innerHTML = `
            <div class="calendar-header">
                <button class="calendar-btn prev-month">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div class="calendar-title"></div>
                <button class="calendar-btn next-month">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            </div>
            <div class="calendar-weekdays">
                <div class="calendar-weekday">日</div>
                <div class="calendar-weekday">一</div>
                <div class="calendar-weekday">二</div>
                <div class="calendar-weekday">三</div>
                <div class="calendar-weekday">四</div>
                <div class="calendar-weekday">五</div>
                <div class="calendar-weekday">六</div>
            </div>
            <div class="calendar-grid"></div>
        `;
        document.body.appendChild(this.popup);

        // Navigation Events
        this.popup.querySelector('.prev-month').addEventListener('click', (e) => {
            e.stopPropagation();
            this.changeMonth(-1);
        });
        this.popup.querySelector('.next-month').addEventListener('click', (e) => {
            e.stopPropagation();
            this.changeMonth(1);
        });

        // Global Click Management
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('date-input')) {
                e.preventDefault(); // Stop native picker
                this.show(e.target);
            } else if (this.popup.classList.contains('show') && !this.popup.contains(e.target) && e.target !== this.currentInput) {
                this.hide();
            }
        });

        // Prevent native picker on inputs
        document.querySelectorAll('.date-input').forEach(input => {
            input.addEventListener('click', (e) => {
                e.preventDefault();
                // On mobile, blur to prevent keyboard
                input.blur();
            });
            input.addEventListener('pointerdown', (e) => e.preventDefault()); // Stronger prevention
        });
    }

    show(input) {
        if (this.currentInput === input && this.popup.classList.contains('show')) return;

        this.currentInput = input;

        // Parse current value or default to today
        const val = input.value;
        if (val) {
            const parts = val.split('-');
            this.currentDate = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
            this.currentDate = new Date();
        }

        this.render();

        // Position
        const rect = input.getBoundingClientRect();
        this.popup.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        const leftPos = rect.left + window.scrollX;

        // Prevent overflow right
        if (leftPos + 280 > window.innerWidth) {
            this.popup.style.left = (window.innerWidth - 290) + 'px';
        } else {
            this.popup.style.left = leftPos + 'px';
        }

        this.popup.classList.add('show');
    }

    hide() {
        this.popup.classList.remove('show');
    }

    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.render();
    }

    render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Update Title
        this.popup.querySelector('.calendar-title').textContent = `${year}年${month + 1}月`;

        // Generate Grid
        const grid = this.popup.querySelector('.calendar-grid');
        grid.innerHTML = '';

        // First day of month
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day empty';
            grid.appendChild(div);
        }

        // Days
        // Get Today for highlighting "Today"
        const now = new Date();
        const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
        const todayDate = now.getDate();

        // Get Selected Date
        let selectedDay = -1;
        if (this.currentInput && this.currentInput.value) {
            const parts = this.currentInput.value.split('-');
            if (parseInt(parts[0]) === year && parseInt(parts[1]) - 1 === month) {
                selectedDay = parseInt(parts[2]);
            }
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.textContent = d;

            if (isCurrentMonth && d === todayDate) div.classList.add('today');
            if (d === selectedDay) div.classList.add('selected');

            div.onclick = (e) => {
                e.stopPropagation();
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                this.currentInput.value = dateStr;
                // Trigger change event
                this.currentInput.dispatchEvent(new Event('change'));
                this.hide();
            };
            grid.appendChild(div);
        }
    }
}

// Initialize
const datePicker = new CustomDatePicker();

// Daily Report Event Listeners
btnGenerateDaily.addEventListener('click', generateDaily);
btnRegenerateDaily.addEventListener('click', generateDaily);
btnSaveDaily.addEventListener('click', saveDaily);

// Weekly Report Event Listeners
btnGenerateWeekly.addEventListener('click', generateWeekly);
btnRegenerateWeekly.addEventListener('click', generateWeekly);
btnSaveWeekly.addEventListener('click', saveWeekly);

// --- Weekly Renderer (Grid Card Mode - Unified Premium Look) ---
function renderWeeklyGridMode(items, container) {
    items.forEach(item => {
        const card = document.createElement('div');
        // Add 'weekly-card' class for special styling (gold/purple glow)
        card.className = 'history-card weekly-card';

        let contentRaw = item.fullContent || item.preview || '';
        contentRaw = removeThinkingContent(contentRaw);

        // Extract 3 Key Points
        const highlightsHtml = extractWeeklyHighlights(contentRaw);

        // Safe encode
        const safeDate = item.date;
        const safeContent = encodeURIComponent(item.fullContent || '');

        const openAction = () => viewHistoryItem(safeDate, safeContent, 'weekly');

        // Bind events
        card.onclick = openAction;

        card.innerHTML = `
            <div class="history-card-header">
                 <div class="list-date-group">
                    <span class="history-date">${item.date}</span>
                 </div>
                 <span class="list-week-badge">第${item.weekNumber}周</span>
            </div>
            
            <div class="weekly-highlight-preview">
                ${highlightsHtml}
            </div>
            
            <div class="weekly-card-footer">
                <span class="mini-meta">📝 ${contentRaw.length}字</span>
                <button class="btn-text-only">详情 ➜</button>
            </div>
        `;

        // Bind click for the button too, although card click covers it
        const detailBtn = card.querySelector('.btn-text-only');
        if (detailBtn) {
            detailBtn.onclick = (e) => {
                e.stopPropagation();
                openAction();
            };
        }

        container.appendChild(card);
    });
}

function extractWeeklyHighlights(markdown) {
    if (!markdown) return '<div class="empty-highlight">暂无摘要</div>';

    const lines = markdown.split('\n');
    const highlights = [];

    // Intelligent extraction: prefer lines with bold text or list items
    for (const line of lines) {
        const clean = line.trim();
        // Skip headers and separators
        if (clean.startsWith('#') || clean.startsWith('---') || clean.length < 5) continue;

        // Match list items
        if (/^[-*]\s/.test(clean) || /^\d+\.\s/.test(clean)) {
            let text = clean.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').replace(/\*\*/g, '');
            if (text.length > 40) text = text.substring(0, 38) + '...';
            highlights.push(text);
        }
        if (highlights.length >= 3) break;
    }

    if (highlights.length === 0) return '<div class="empty-highlight">点击查看周报详情</div>';

    return `<ul>${highlights.map(h => `<li>${h}</li>`).join('')}</ul>`;
}

// ===============================================
// Edit Mode Functions (Reusable Component)
// ===============================================

/**
 * Toggle edit mode for a report type
 * @param {string} type - 'daily' or 'weekly'
 */
function toggleEditMode(type) {
    const isDaily = type === 'daily';
    const editMode = isDaily ? dailyEditMode : weeklyEditMode;
    const newMode = !editMode;

    // Update state
    if (isDaily) {
        dailyEditMode = newMode;
    } else {
        weeklyEditMode = newMode;
    }

    // Update UI
    updateEditButtonState(type, newMode);

    const outputRender = isDaily ? dailyOutputRender : weeklyOutputRender;
    const editTextarea = isDaily ? dailyEditTextarea : weeklyEditTextarea;
    const charCounter = isDaily ? dailyCharCounter : weeklyCharCounter;
    const cache = isDaily ? generatedDailyCache : generatedWeeklyCache;

    if (newMode) {
        // Enter edit mode
        const cleanContent = removeThinkingContent(cache?.generatedReport || '');
        editTextarea.value = cleanContent;
        outputRender.style.display = 'none';
        editTextarea.style.display = 'block';
        charCounter.style.display = 'block';
        updateCharCounter(type, cleanContent.length);
        editTextarea.focus();
    } else {
        // Exit edit mode (preview the edited content)
        const editedContent = editTextarea.value;

        // Update cache with edited content
        if (cache) {
            cache.generatedReport = editedContent;
        }

        // Render the markdown
        outputRender.innerHTML = marked.parse(editedContent);
        outputRender.style.display = 'block';
        editTextarea.style.display = 'none';
        charCounter.style.display = 'none';
    }
}

/**
 * Update edit button visual state
 * @param {string} type - 'daily' or 'weekly'
 * @param {boolean} isEditMode - whether in edit mode
 */
function updateEditButtonState(type, isEditMode) {
    const btn = type === 'daily' ? btnEditDaily : btnEditWeekly;
    if (!btn) return;

    const btnText = btn.querySelector('.edit-btn-text');

    if (isEditMode) {
        btn.classList.add('active');
        if (btnText) btnText.textContent = '预览';
    } else {
        btn.classList.remove('active');
        if (btnText) btnText.textContent = '编辑';
    }
}

/**
 * Update character counter
 * @param {string} type - 'daily' or 'weekly'
 * @param {number} count - character count
 */
function updateCharCounter(type, count) {
    const counter = type === 'daily' ? dailyCharCounter : weeklyCharCounter;
    if (!counter) return;

    counter.textContent = `字数统计：${count} 字`;

    // Warning for very long content
    if (count > 5000) {
        counter.classList.add('warning');
    } else {
        counter.classList.remove('warning');
    }
}

/**
 * Get the final report content (returns edited content if in edit mode)
 * @param {string} type - 'daily' or 'weekly'
 * @returns {string} - the final report content
 */
function getFinalReportContent(type) {
    const isDaily = type === 'daily';
    const editMode = isDaily ? dailyEditMode : weeklyEditMode;
    const editTextarea = isDaily ? dailyEditTextarea : weeklyEditTextarea;
    const cache = isDaily ? generatedDailyCache : generatedWeeklyCache;

    if (editMode && editTextarea) {
        // Return edited content
        return editTextarea.value;
    }

    // Return cached content
    return cache?.generatedReport || '';
}

// ===============================================
// Edit Mode Event Listeners
// ===============================================

// Bind Edit Button Click Events
if (btnEditDaily) {
    btnEditDaily.addEventListener('click', () => toggleEditMode('daily'));
}

if (btnEditWeekly) {
    btnEditWeekly.addEventListener('click', () => toggleEditMode('weekly'));
}

// Bind Textarea Input Events (for character counter)
if (dailyEditTextarea) {
    dailyEditTextarea.addEventListener('input', (e) => {
        updateCharCounter('daily', e.target.value.length);
        // Live update cache
        if (generatedDailyCache) {
            generatedDailyCache.generatedReport = e.target.value;
        }
    });
}

if (weeklyEditTextarea) {
    weeklyEditTextarea.addEventListener('input', (e) => {
        updateCharCounter('weekly', e.target.value.length);
        // Live update cache
        if (generatedWeeklyCache) {
            generatedWeeklyCache.generatedReport = e.target.value;
        }
    });
}

// ===============================================
// Override Save Functions to Use Edited Content
// ===============================================

// Extend the original saveDaily function
const originalSaveDaily = saveDaily;
saveDaily = async function () {
    // If in edit mode, sync textarea content to cache first
    if (dailyEditMode && dailyEditTextarea && generatedDailyCache) {
        generatedDailyCache.generatedReport = dailyEditTextarea.value;
    }

    // Call original save function
    await originalSaveDaily();

    // Reset edit mode after save
    dailyEditMode = false;
    updateEditButtonState('daily', false);
};

// Extend the original saveWeekly function  
const originalSaveWeekly = saveWeekly;
saveWeekly = async function () {
    // If in edit mode, sync textarea content to cache first
    if (weeklyEditMode && weeklyEditTextarea && generatedWeeklyCache) {
        generatedWeeklyCache.generatedReport = weeklyEditTextarea.value;
    }

    // Call original save function
    await originalSaveWeekly();

    // Reset edit mode after save
    weeklyEditMode = false;
    updateEditButtonState('weekly', false);
};
