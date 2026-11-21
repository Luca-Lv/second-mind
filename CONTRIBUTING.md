# 贡献指南

## 开发环境

- Node.js ≥ 18（见 `.nvmrc`）
- 不需要数据库：默认本地模式即可开发全部界面与交互

```bash
npm install
npm run dev
npm run typecheck
npm test
```

## 提交前

CI 会跑这三条，本地请先自查：

```bash
npm run typecheck && npm test && npm run build
```

## 代码约定

- **视图不直接写数据**：所有写入走 `src/data.ts`，这样本地模式与云模式行为一致
- **类型优先**：不为省事用 `any`；确实需要时在调用处断言并写明原因
- **样式走 token**：`src/styles.css` 顶部定义颜色、间距、动效；不要在组件里写死色值
- **只用 ASCII 引号**：代码与配置里的引号必须直引号
- **注释解释「为什么」**：例如「这里延迟 180ms 是为了避免标签闪烁」，不要复述代码在做什么
- **中文文案统一用中文标点**，代码标识符用英文

## 无障碍基线

新增交互请确认：

- 可以用键盘完成，焦点可见
- 不只用颜色传达状态（待办有勾选态、进度有数值）
- 对比度：正文 ≥ 4.5:1，UI 与大字 ≥ 3:1
- 动效尊重 `prefers-reduced-motion`
- Canvas 里的信息在有等价 DOM 入口（参考大纲视图）

## 提交信息

用 Conventional Commits 风格，一句话说清改了什么、为什么：

```
feat(network): 邻近展开改为停留 120ms 触发

快速划过时会连续触发多簇，标签闪烁明显。
```

类型：`feat` / `fix` / `refactor` / `docs` / `perf` / `a11y` / `chore`

## Pull Request

- 一个 PR 只做一件事
- 说明动机与影响范围；涉及视觉改动请附前后对比
- 涉及数据结构变更，请同时提交 `docs/migrations/` 下的迁移 SQL 并更新 `docs/DATABASE.md`

## 报告问题

用 Issue 模板，附上：复现步骤、期望与实际、浏览器与版本、是否本地模式、控制台报错。

安全漏洞**不要**开公开 Issue，见 [SECURITY.md](../SECURITY.md)。
