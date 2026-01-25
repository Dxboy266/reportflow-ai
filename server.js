const express = require('express');
const cors = require('cors');
const { getConfig, loadConfig } = require('./server/config');

const app = express();
const config = getConfig();
const PORT = config.server && config.server.port ? config.server.port : 3000;

// Middleware
const path = require('path');

// Middleware
app.use(cors());
app.use(express.json());
// Fix for Electron packaging: Use absolute path
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/config', require('./server/routes/system'));
app.use('/api/history', require('./server/routes/history'));
app.use('/api', require('./server/routes/daily'));
app.use('/api', require('./server/routes/weekly'));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
