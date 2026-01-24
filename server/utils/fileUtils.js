const fs = require('fs');
const { promisify } = require('util');
const path = require('path');

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);
const readdirAsync = fs.promises.readdir;

async function ensureDir(dirPath) {
    try {
        await mkdirAsync(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

module.exports = {
    fs,
    path,
    writeFileAsync,
    readFileAsync,
    readdirAsync,
    ensureDir
};
