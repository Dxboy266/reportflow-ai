const fs = require('fs');
const path = require('path');

// Configuration
const YEAR = 2026;
const MONTH = 1; // January
const WEEK_NUMBER = 4; // Assuming late Jan falls into W04 or W03 depending on year start. Let's calculate dynamically or just force it for test.
// 2026-01-19 was a Monday.
// Let's create data for 19th (Mon) to 23rd (Fri).

// Mock Data Input
const mockDailies = [
    {
        date: '2026-01-19',
        content: `**邮件主题建议：** 1月19日工作日报 - 1.53版本需求分析与Hadoop技术储备

---

### 一、今日工作明细

**1. 业务迭代推进 (1.53版本)**
- **背景/目标**：对接并梳理 1.53 版本迭代的核心需求，明确业务逻辑与功能边界。
- **具体工作**：
  - 需求分析：对接并梳理 1.53 版本迭代的核心需求。
  - 方案设计：基于需求完成了初步的技术方案设计，梳理了涉及Module 的改动及Data Flow逻辑。
- **成果/进度**：完成初步技术方案设计。

**2. 技术底座夯实**
- **具体工作**：
  - 原理研读：深入学习 Hadoop 核心组件原理（重点关注 HDFS/MapReduce）。
  - 文档输出：整理输出《Hadoop 核心架构学习笔记》，系统化梳理了大数据底层支撑逻辑。
- **成果/进度**：输出学习笔记一份。

---

### 二、问题与收获
无

---

### 三、明日计划
1. 发起或参与 1.53 版本技术方案评审。
2. 准备 1.53 版本所需的开发分支与本地调试环境。`,
        raw: "1.53版本需求分析，Hadoop学习"
    },
    {
        date: '2026-01-20',
        content: `**邮件主题建议：** 1月20日工作日报 - 1.53版本Y2038需求交付与部署

---

### 一、今日工作明细

**1. 1.53版本需求交付 (核心产出)**
- **背景/目标**：解决系统时间戳在2038年溢出的潜在风险。
- **具体工作**：
  - 需求开发：完成 Y2038 问题相关需求的代码编写与逻辑实现。
  - 质量保障：完成本地功能自测，并修复发现的边界问题。
  - 环境部署：成功将代码部署至开发环境 (Dev)。
- **成果/进度**：Dev环境验证服务启动正常。

**2. 技术评审**
- **具体工作**：参与业务技术方案评审，明确了后续模块的开发规范与交互逻辑。

**3. 技术储备**
- **具体工作**：初步学习 Kubernetes (K8s) 基础架构，了解 Pod、Node、Service 等核心概念。

---

### 二、问题与收获
- **收获**：对K8s基础组件有了初步认知。

---

### 三、明日计划
1. 在开发环境对 Y2038 需求进行集成验证。
2. 在本地或测试环境尝试部署一个简单的 K8s Pod。`,
        raw: "Y2038需求开发部署，K8s学习"
    },
    {
        date: '2026-01-21',
        content: `**邮件主题建议：** 1月21日工作日报 - 开发平台启动环境修复与K8s机制研究

---

### 一、今日工作明细

**1. 开发平台启动故障排查 (Troubleshooting)**
- **背景/目标**：开发平台服务启动失败，报错 FileSystemException。
- **具体工作**：
  - 定位根因：深入分析堆栈日志，定位到容器在运行时因用户组权限限制无法创建持久化目录。
  - 机制溯源：研究了 K8s 容器的存储挂载机制及 Pod 的安全上下文配置。
  - 处理结果：修复了目录权限/挂载配置问题。
- **成果/进度**：服务已恢复正常启动。

**2. 技术沉淀**
- **具体工作**：将本次涉及的 K8s 容器目录挂载与 Linux 权限冲突的排查经验整理归档。
- **成果/进度**：补充至环境避坑指南中。

---

### 二、问题与收获

- **遇到的问题**：容器无法创建持久化目录。
- **解决思路**：调整 SecurityContext fsGroup 配置。
- **技术沉淀**：深入理解了 K8s 卷挂载权限机制。

---

### 三、明日计划
1. 确认环境稳定后，继续推进 1.53 版本后续联调。
2. 进一步熟悉 K8s ConfigMap 与 PVC 配置。`,
        raw: "开发平台启动报错排查，K8s权限研究"
    },
    {
        date: '2026-01-22',
        content: `**邮件主题建议：** 1月22日工作日报 - 1.53版本联调与K8s ConfigMap实践

---

### 一、今日工作明细

**1. 1.53版本联调 (Integration Test)**
- **背景/目标**：验证 Y2038 修复在集成环境的表现。
- **具体工作**：
  - 联合测试：配合QA进行首轮集成测试，跟进测试反馈的2个非阻塞性问题。
  - 问题修复：快速响应并修复了日期格式化边界值的兼容性 Bug。
- **成果/进度**：核心流程跑通，测试准入通过。

**2. K8s ConfigMap 实践**
- **背景/目标**：提升配置管理的灵活性。
- **具体工作**：
  - 实践操作：在测试环境将硬编码的应用配置迁移至 K8s ConfigMap。
  - 验证：验证了 Pod 重启后配置热加载机制（部分实现）。
- **成果/进度**：成功实现配置与代码分离。

---

### 二、问题与收获
- **收获**：掌握了 ConfigMap 挂载为环境变量和文件的两种方式。

---

### 三、明日计划
1. 完成 1.53 版本所有已知 Bug 修复，准备代码封板。
2. 整理本周技术学习笔记，准备周报。`,
        raw: "1.53联调，ConfigMap实践"
    },
    {
        date: '2026-01-23',
        content: `**邮件主题建议：** 1月23日工作日报 - 本周工作收尾与代码封板

---

### 一、今日工作明细

**1. 1.53版本收尾**
- **背景/目标**：确保版本按时进入 Code Freeze 阶段。
- **具体工作**：
  - 代码封板：检查所有分支代码，执行最终 Merge Request，确保 CI 流水线全绿。
  - 文档同步：更新 Release Note，标记 Y2038 修复点。
- **成果/进度**：代码已冻结，待下周发布。

**2. 本周复盤**
- **具体工作**：整理本周 K8s 学习笔记与故障排查案例，汇总为周报素材。
- **成果/进度**：完成周报草稿。

---

### 二、问题与收获
无

---

### 三、下周计划
1. 1.53 版本生产环境发布与观察。
2. 开始下一阶段 Kubernetes Operator 模式的学习。`,
        raw: "代码封板，周报整理"
    }
];

// Helper Functions (Copied from server.js Logic)
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

// Execution
async function generate() {
    console.log("Generating mock data...");

    for (const item of mockDailies) {
        const weekPath = getWeekPath(item.date);
        const dailyDir = path.join(weekPath, 'daily');

        // Ensure dir
        if (!fs.existsSync(dailyDir)) {
            fs.mkdirSync(dailyDir, { recursive: true });
        }

        const fileName = `${item.date.substring(5)}.json`;
        const filePath = path.join(dailyDir, fileName);

        const data = {
            date: item.date,
            weekday: new Date(item.date).toLocaleDateString('zh-CN', { weekday: 'long' }),
            rawContent: item.raw,
            generatedReport: item.content,
            style: 'formal',
            createdAt: new Date().toISOString()
        };

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Created: ${filePath}`);
    }

    console.log("Done! Mock data for W04 (Jan 19-23, 2026) created.");
}

generate();
