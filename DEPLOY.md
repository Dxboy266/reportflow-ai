# 🚀 部署上线指南 (Deployment Guide)

恭喜您完成了 ReportFlow AI 的开发！本指南将帮助您将应用部署到线上服务器，让您可以随时随地访问。

## 📋 部署前准备

由于本项目使用 **本地 JSON 文件** (`data/` 目录) 来存储日报及周报数据，因此**不适合**部署在 Vercel、Netlify 等 Serverless 平台（会导致数据丢失）。

**推荐方案**：阿里云 / 腾讯云 **轻量应用服务器** (Lightweight Server)。
**推荐镜像**：Node.js 镜像 (自带 Node 环境，开箱即用)。

---

## 🛠️ 第一步：代码上传

建议使用 Git 进行代码同步（推荐使用 Gitee，国内速度快）。

1. **项目根目录创建 `.gitignore` 文件** (如果尚未创建)，内容如下：
   ```text
   node_modules/
   .env
   .DS_Store
   logs/
   ```

2. **提交代码到远程仓库**：
   ```bash
   git init
   git add .
   git commit -m "Ready for deploy"
   # 关联您的远程仓库
   git remote add origin https://gitee.com/您的用户名/project-name.git
   git push -u origin master
   ```

---

## 🖥️ 第二步：服务器操作

1. **登录服务器**：
   使用 SSH 工具 (Terminal, Xshell, FinalShell) 或云厂商控制台的 "远程连接"。

2. **拉取代码**：
   ```bash
   # 进入目录 (通常在 /home 或 /www/wwwroot)
   cd /home
   
   # 克隆项目
   git clone https://gitee.com/您的用户名/project-name.git
   
   # 进入项目文件夹
   cd project-name
   ```

3. **安装依赖**：
   ```bash
   # 安装生产环境依赖
   npm install --production
   ```

---

## 🚀 第三步：启动与保活 (使用 PM2)

我们使用 `PM2` 来管理 Node.js 服务，它可以让应用在后台运行，并在崩溃或重启服务器后自动重启。

1. **安装 PM2** (如果服务器没自带)：
   ```bash
   npm install -g pm2
   ```

2. **启动应用**：
   ```bash
   # 启动 server.js 并命名为 report-app
   pm2 start server.js --name "report-app"
   ```

3. **保存当前进程列表** (确保重启后自动启动)：
   ```bash
   pm2 save
   pm2 startup
   # (执行 pm2 startup 后，它会提示您复制一行命令运行，请照做)
   ```

4. **查看状态**：
   ```bash
   pm2 list    # 查看运行状态
   pm2 logs    # 查看运行日志
   ```

---

## 🌐 第四步：访问应用

您的应用默认运行在 **3000** 端口。

1. **开放防火墙端口**：
   去云服务器控制台 -> 防火墙/安全组 -> 添加规则 -> **开放 TCP 3000 端口**。

2. **访问**：
   在浏览器输入：`http://您的服务器公网IP:3000`

---

## 🔄 后续更新

当您在本地修改了代码后：

1. **本地**：
   ```bash
   git add .
   git commit -m "update feature"
   git push
   ```

2. **服务器**：
   ```bash
   cd /home/project-name
   git pull            # 拉取最新代码
   npm install         # 如果有新依赖
   pm2 restart report-app  # 重启服务
   ```

---

## ⚠️ 数据备份提示

您的数据都在服务器的 `data/` 目录下。建议定期备份该文件夹：
```bash
# 打包备份 data 目录
tar -czvf backup_data_2026.tar.gz data/
```
