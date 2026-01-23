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

const historyList = document.getElementById('history-list');

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

    try {
        const checkRes = await fetch(`${API_BASE}/check-exists?type=daily&date=${dateStr}`);
        const checkData = await checkRes.json();

        if (checkData.exists) {
            if (!confirm('检测到今日日报已存在，是否继续生成？(后续保存将覆盖旧文件)')) {
                return;
            }
        }
    } catch (e) {
        // Ignore check error, proceed
        console.warn('Check exists failed', e);
    }

    setLoading(targetBtn, true);

    // Prevent double clicking the other button
    btnGenerateDaily.disabled = true;
    btnRegenerateDaily.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/generate-daily`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, style })
        });

        const data = await res.json();

        if (data.success) {
            const renderEl = document.getElementById('daily-output-render');
            renderEl.innerHTML = marked.parse(data.report);

            dailyPreviewContainer.style.display = 'block';

            // Success state: Input Generate disabled, Preview Regenerate enabled
            btnGenerateDaily.disabled = true;
            btnRegenerateDaily.disabled = false;

            generatedDailyCache = {
                rawContent: content,
                generatedReport: data.report,
                style: style
            };

            // Only scroll if it's the first generation (from input area)
            if (targetBtn === btnGenerateDaily) {
                dailyPreviewContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            alert('生成失败: ' + data.error);
            // Revert state on failure
            btnGenerateDaily.disabled = false;
            btnRegenerateDaily.disabled = false;
        }
    } catch (e) {
        alert('网络错误');
        btnGenerateDaily.disabled = false;
        btnRegenerateDaily.disabled = false;
    } finally {
        setLoading(targetBtn, false);
    }
}


async function saveDaily() {
    if (!generatedDailyCache) return;

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

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
            // Copy to clipboard
            await copyToClipboard(generatedDailyCache.generatedReport);
            showToast('✅ 日报已保存并复制到剪贴板！');

            // Reset UI
            dailyPreviewContainer.style.display = 'none';
            dailyInput.value = '';
            btnGenerateDaily.disabled = false; // Re-enable
            generatedDailyCache = null;
            loadHistory();
        } else {
            alert('保存失败: ' + data.error);
        }
    } catch (e) {
        alert('保存失败');
    }
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
            if (!confirm('检测到本周周报已存在，是否继续生成？(后续保存将覆盖旧文件)')) {
                return;
            }
        }
    } catch (e) {
        console.warn('Check exists failed', e);
    }

    setLoading(targetBtn, true);

    try {
        const res = await fetch(`${API_BASE}/generate-weekly`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ style })
        });

        const data = await res.json();

        if (data.success) {
            weeklyOutput.value = data.report;
            weeklyPreviewContainer.style.display = 'block';
            generatedWeeklyCache = {
                generatedReport: data.report,
                style: style
            };
        } else {
            alert('生成失败: ' + data.error);
        }
    } catch (e) {
        alert('网络错误');
    } finally {
        setLoading(btnGenerateWeekly, false);
    }
}

async function saveWeekly() {
    if (!generatedWeeklyCache) return;

    try {
        const res = await fetch(`${API_BASE}/save-weekly`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(generatedWeeklyCache)
        });

        const data = await res.json();
        if (data.success) {
            alert('周报已保存! 路径: ' + data.path);
            weeklyPreviewContainer.style.display = 'none';
            generatedWeeklyCache = null;
        } else {
            alert('保存失败: ' + data.error);
        }
    } catch (e) {
        alert('保存失败');
    }
}

// History
async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/current-week/dailies`);
        const data = await res.json();

        historyList.innerHTML = '';
        if (data.dailies && data.dailies.length > 0) {
            data.dailies.forEach(item => {
                const el = document.createElement('div');
                el.className = 'history-item';
                el.innerHTML = `
                    <div class="history-date">${item.date} (${item.weekday})</div>
                    <div class="history-status">✅ 已保存</div>
                `;
                el.onclick = () => {
                    openReportModal(item.date, item.generatedReport);
                };
                el.style.cursor = 'pointer';
                historyList.appendChild(el);
            });
        } else {
            historyList.innerHTML = '<div class="history-empty">本周暂无记录</div>';
        }
    } catch (e) {
        historyList.innerHTML = '<div class="history-empty">加载失败</div>';
    }
}

// Report Modal Logic
const reportModal = document.getElementById('report-modal');
const closeReportModalBtn = document.querySelector('.close-report-modal');
const reportModalTitle = document.getElementById('report-modal-title');
const reportModalBody = document.getElementById('report-modal-body');
const btnCopyReport = document.getElementById('btn-copy-report');

function openReportModal(date, content) {
    reportModalTitle.textContent = `${date} 日报详情`;
    reportModalBody.innerHTML = marked.parse(content);
    reportModal.classList.add('show');

    // Setup copy button
    btnCopyReport.onclick = () => {
        copyToClipboard(content);
        showToast('内容已复制');
    };
}

closeReportModalBtn.onclick = () => reportModal.classList.remove('show');
window.addEventListener('click', (e) => {
    if (e.target === reportModal) reportModal.classList.remove('show');
});

// Utils
function setLoading(btn, isLoading) {
    if (isLoading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = '处理中...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        btn.innerText = btn.dataset.originalText || btn.innerText;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
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
