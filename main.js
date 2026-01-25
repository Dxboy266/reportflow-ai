const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const server = require('./server.js'); // Import and start Express Server

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        title: 'ReportFlow AI',
        icon: path.join(__dirname, 'public/favicon.ico'), // 假设有个图标
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true // 隐藏丑陋的菜单栏
    });

    // 等待 Server 启动 (3000端口)
    // 在 server/index.js 里我们通常是 app.listen(3000)
    // 给它一点时间或者直接加载
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 1000);

    // 拦截外部链接，使用默认浏览器打开 (比如点生成的周报里的参考链接)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

// 所有窗口关闭时退出应用
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});
