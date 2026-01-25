const path = require('path');
const fs = require('fs');
const { getConfig } = require('../config');

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getDataRoot() {
    // 1. Check User Config
    try {
        const config = getConfig();
        if (config && config.dataDir) {
            return config.dataDir;
        }
    } catch (e) { }

    // 2. Detect Electron
    const isElectron = process.versions && process.versions.electron;

    if (isElectron) {
        // Production: AppData
        const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
        return path.join(appData, 'ReportFlowAI', 'data');
    }

    // 3. Dev: Local
    return path.join(process.cwd(), 'data');
}

function getWeekPath(dateStr) {
    const dataRoot = getDataRoot();

    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const week = 'W' + String(getWeekNumber(date)).padStart(2, '0');
    return path.join(dataRoot, String(year), month, week);
}

function getDateString(daysAgo = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
}

module.exports = { getWeekNumber, getWeekPath, getDateString, getDataRoot };
