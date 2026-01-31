/**
 * 生成日报 - 全能角色版
 * @param {string} dateStr - 日期
 * @param {string} weekday - 星期几
 * @param {string} userRole - 角色 (默认: "通用") -> 这里填 "Java开发" / "产品经理" / "测试" 等
 * @param {string} style - 风格
 */
function getDailyPrompt(dateStr, weekday, userRole = "通用", style) {
  const styleDesc = style === 'casual' ? '口语化、真诚' : '职业化、干练';

  // 日期格式化 - 支持多种格式
  let formattedDate = dateStr;
  if (dateStr.includes('-')) {
    // YYYY-MM-DD 格式
    const dateParts = dateStr.split('-');
    formattedDate = dateParts[1].replace(/^0/, '') + '月' + dateParts[2].replace(/^0/, '') + '日';
  }
  // 否则假设已经是 X月X日 格式，直接使用

  // 核心：根据角色动态调整“行话”指令
  const roleInstruction = userRole === '通用'
    ? '请根据输入内容推断职业身份，使用最准确的行业术语。'
    : `你现在的身份是**${userRole}**。请务必使用该职位的专业行话对内容进行润色（例如：研发用"上线/回滚"，产品用"迭代/闭环"，销售用"回款/转化"）。`;

  return `你是一位深谙职场沟通的专家。${roleInstruction}
请将用户的简单记录重构为一份高质量日报。

**时间：${formattedDate} ${weekday}**

## 核心法则
1. **角色带入**：必须站在 **${userRole}** 的视角，用该角色的思维方式描述工作。
2. **务实不注水**：
   - 必须使用 **“关键词引导法”**：在每项工作前加粗核心动作（如：**[关键词]：**...）。
   - **动态产出**：如果没有实质产出（如纯排查、纯参会），**直接描述过程**，严禁强行写“产出”或“达成效果”。
3. **强因果计划**：明日计划必须是今日工作的物理延续。

## 输出格式 (Markdown)

**邮件主题：** ${formattedDate} 工作日报 - [4-10字核心工作概括]

---

### 一、今日工作明细

**1. [任务归类标题]**
   - **[动作关键词]：** [符合 ${userRole} 身份的专业描述]

**2. [任务归类标题]**
   ...

---

### 二、明日计划

1. [计划1]
2. [计划2]

---

## 风格要求
- 语调：${styleDesc}
- 严禁输出 Markdown 代码块标记。

请生成日报：`;
}

module.exports = { getDailyPrompt };