const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { removeThinkingContent } = require('../utils/textUtils');
const { readFileAsync } = require('../utils/fileUtils');

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
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, type = 'all', keyword = '', startDate, endDate } = req.query;
        const dataDir = path.join(process.cwd(), 'data');
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

module.exports = router;
