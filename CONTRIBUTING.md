# Contributing to ReportFlow AI

感谢你愿意参与 ReportFlow AI 的建设！

## 开发环境

- Node.js >= 16
- npm >= 8

```bash
git clone https://github.com/Dxboy266/reportflow-ai
cd reportflow-ai
npm install
npm start
```

## 分支与提交规范

- 新功能：`feature/<name>`
- 修复问题：`fix/<name>`
- 文档改进：`docs/<name>`

提交信息建议：

- `feat: add xxx`
- `fix: resolve xxx`
- `docs: improve xxx`

## Pull Request 要求

请在 PR 描述中包含：

1. 背景与目标
2. 具体改动点
3. 本地验证方式
4. 风险与回滚说明（如有）

## 不建议提交的内容

- `node_modules/`
- `data/` 用户私有数据
- `config.json`（含 API Key）

## Issue 建议模板

- 问题现象
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（系统、Node 版本）

欢迎你的每一个改进建议和 PR。