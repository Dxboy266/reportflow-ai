const path = require('path');

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getWeekPath(dateStr) {
    // Determine data root relative to CWD (project root)
    const dataRoot = path.join(process.cwd(), 'data');

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

module.exports = { getWeekNumber, getWeekPath, getDateString };
