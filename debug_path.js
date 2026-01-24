const path = require('path');
const fs = require('fs');

// Copy from server.js
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

// Test
const dateStr = '2026-01-24';
const weekPath = getWeekPath(dateStr);
const dailyDir = path.join(weekPath, 'daily');
const fileName = `${dateStr.substring(5)}.json`;
const filePath = path.join(dailyDir, fileName);

console.log(`Checking date: ${dateStr}`);
console.log(`Week Path: ${weekPath}`);
console.log(`Expected Path: ${filePath}`);
console.log(`Exists: ${fs.existsSync(filePath)}`);

// Check directory listing
if (fs.existsSync(dailyDir)) {
    console.log('Dir contents:', fs.readdirSync(dailyDir));
} else {
    console.log('Daily dir does not exist');
}
