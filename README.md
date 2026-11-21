# second mind

> 用一张神经元网络，梳理「我是谁」。

[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/react-19-0b7285.svg)](https://react.dev)
[![Vite 6](https://img.shields.io/badge/vite-6-646cff.svg)](https://vite.dev)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

身份词是第一级神经元，技能、步骤、进度、待办是它伸出的突触。平时你只看见第一级；只有当指针**靠近**某个小点，那一簇才亮起名字。

这是「身份」优先的笔记工具：不是先写笔记再打标签，而是先把「我有哪些身份、各自长到哪一步」摆成一张网。

```
┌─ Network ─────────────────────────────────────────────┐
│        ● 设计师            ● 写作者                    │
│       ╱   ╲                 │                         │
│     ·       ·               ·   ← 二级以下只显示小点     │
│    (指针靠近才展开这一簇)      ·                        │
└───────────────────────────────────────────────────────┘
```

---

## 30 秒跑起来

```bash
git clone https://github.com/<你的账号>/second-mind.git
cd second-mind
npm install
npm run dev        # http://localhost:5173
```

不需要注册、不需要数据库、不需要手机号——**默认就是本地模式**，打开即可用。

## 两种运行模式

| | 本地模式（默认） | 云模式 |
|---|---|---|
| 触发条件 | 没有配置 `VITE_CLOUD_*` | 配置了 `VITE_CLOUD_ENDPOINT` + `VITE_CLOUD_KEY` |
| 数据存放 | 浏览器 `localStorage` | 云数据库（PostgreSQL + 行级隔离） |
| 登录 | 无，一键进入 | 手机号 + 短信验证码，同一号码最多 3 台设备，15 天免登录 |
| 多设备同步 | 无 | 约 1–2 秒内合并 |
| 适用 | 试用、fork 二次开发、离线演示 | 真实自用、多设备 |

> 本地模式换浏览器或清站点数据即丢失，这是有意的取舍：让 fork 的人零门槛先看到产品，再决定要不要接后端。

## 三个视图，一份数据

| 视图 | 作用 | 实现 |
|---|---|---|
| **Network** | 全局图谱。第一级身份词常显名字，球体大小随内容量增长；二级以下只有小点，指针靠近 28px 且停留 120ms 才展开这一簇（自己 + 一环邻居），移开 180ms 收起。 | Canvas 2D + d3-force |
| **工作台** (Board) | 单个身份词的搭建台。加节点、拖拽、连线、勾待办、拉进度。卡片右缘圆点拖到另一张卡片即建立连接。 | 真实 DOM，可键盘操作 |
| **大纲** (Outline) | 同一份数据的树形列表。Canvas 对键盘与读屏天生不友好，这里是等价入口。 | 语义化 HTML |

为什么不做成纯 Canvas 应用：图谱好看，但标题、复选框、进度条必须是真的可操作元素。所以图谱用 Canvas，编辑用 DOM。

## 能做什么

- 身份词：自建、改名、改色、删除（删除是软删，可同步到其它设备）
- 内容节点：技能 / 步骤 / 进度 / 待办 / 笔记 / 疑问，六种类型随时切换
- 任意节点之间可连线，也可连到别的身份词——跨身份引用是这张网的价值所在
- 待办是真复选框，进度是真滑块，标题双击即改
- 浅色 / 深色两套主题，跟随系统，可手动锁定
- 移动优先响应式；触屏没有 hover，邻近展开改为长按 200ms

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器，5173 端口 |
| `npm run build` | 生产构建到 `dist/` |
| `npm run build:web` | 构建到 `site/`（某些托管链路会跳过 `dist/`） |
| `npm run preview` | 预览构建产物 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | 本地后端（增删改查 / rev 游标 / 3 台设备裁决）烟雾测试 |

## 接入你自己的后端

```bash
cp .env.example .env.local
# 填入 VITE_CLOUD_ENDPOINT 与 VITE_CLOUD_KEY，然后重新构建
npm run build
```

1. 准备一个 PostgreSQL + PostgREST 风格的云环境（Supabase 或任意兼容实现均可）
2. 执行 [`docs/schema.sql`](docs/schema.sql)：四张表、`rev` 序列与触发器、RLS 策略、两个设备 RPC
3. 把 endpoint 与 publishableKey 写入 `.env.local`
4. `npm run build`

前端只通过 `src/cloud.ts` 选后端，业务逻辑全在 `src/data.ts`。换成自建 API 时只需要实现同一小撮链式方法（见 `src/backend/local.ts` 的实现，约 300 行）。

> `publishableKey` 只标识「哪个应用」，本身不带权限；服务端按 Origin 精确校验，可以出现在前端产物里。真正的隔离靠数据库 RLS，不靠这把钥匙。

## 部署

```bash
npm run build      # 产物在 dist/，base 已设为 './'，放在子路径也能用
```

把 `dist/` 丢给 GitHub Pages、Vercel、Netlify 或任意静态服务器即可。没有客户端路由，不需要 rewrite 规则。

云模式记得在**构建环境**里设置 `VITE_CLOUD_ENDPOINT` 与 `VITE_CLOUD_KEY`（这两个值在构建时被内联，运行时不读环境变量）；漏设会打出一个本地模式产物。

## 数据结构

四张表，全部按 `owner_id` 行级隔离。

```sql
identities  (id, owner_id, name, color, sort_order, x, y, rev, created_at, updated_at, deleted_at)
nodes       (id, owner_id, identity_id, parent_id, kind, title, note, status, progress,
             x, y, collapsed, rev, created_at, updated_at, deleted_at)
edges       (id, owner_id, source_id, source_kind, target_id, target_kind, kind, label,
             rev, created_at, updated_at, deleted_at)
devices     (id, owner_id, device_key, label, platform, created_at, last_seen_at,
             expires_at, revoked_at)
```

- `source_kind` / `target_kind`（`identity` 或 `node`）：节点 id 与身份词 id 会撞号，跨类型连线必须靠这两列区分
- `rev`：由全局序列在触发器里自增，是所有增量同步的游标
- 删除一律软删（写 `deleted_at`），这样删除也能通过 `rev` 增量同步，并且可撤销

完整 DDL、RLS 与函数见 [`docs/schema.sql`](docs/schema.sql)，字段说明见 [`docs/DATABASE.md`](docs/DATABASE.md)。

## 关于「实时」，必须说清楚

这里的实时**不是** WebSocket 推送：

- 本机改动立即生效（乐观更新）
- 同一浏览器的多个标签页通过 `BroadcastChannel` 立刻互相同步
- 跨设备每 1.5 秒拉一次 `rev > cursor` 的增量，切回页面时立刻拉一次

所以跨设备延迟约 **1–2 秒**，不是零。要真推送，需要把数据层换成支持订阅的后端（Supabase Realtime / Hocuspocus），`src/data.ts` 是唯一要改的文件。

## 关于「绑定设备」的边界

Web 端绑不了硬件。所谓 15 天免登录，本质是一枚 15 天有效、与设备指纹弱绑定的会话。

因此做了三件事：令牌只走客户端存储、设备列表可远程注销、超过 3 台必须踢掉一台才能继续。但**拿到令牌的人仍然能以你的身份访问**。

要彻底解决只能端到端加密：内容在浏览器加密后再上传，代价是忘记恢复码即永久丢数据，且服务端无法搜索。当前版本没有开启。

## 无障碍

- 正文与背景对比度 ≥ 4.5:1，UI 组件与大字 ≥ 3:1（浅色三级灰原为 `#8A90A0` 仅 2.98:1，已调到 `#6A7180`）
- 状态不只用颜色表达：待办有勾选态、进度有数值、连线有方向
- 全部操作有可见焦点环，弹窗有焦点陷阱与 `Esc` 关闭
- 尊重 `prefers-reduced-motion`；图谱是 Canvas，因此另有大纲视图作为等价入口

## 已知取舍

- 力导向布局是确定性的：同一份数据每次打开位置一致，空间记忆不会漂移。新增节点局部松弛，可手动「重新排布」
- 建议节点数控制在几千以内。Canvas 而非 WebGL，万级需要换渲染后端
- 布局计算在主线程，规模再上一个量级应移入 Web Worker
- 本地模式用 `localStorage`，容量约 5MB（大致数千节点）

## Roadmap

- [ ] 图谱布局移入 Web Worker
- [ ] 回收站（软删数据 30 天后清理）
- [ ] 可选的端到端加密开关
- [ ] 导出 / 导入 JSON
- [ ] 键盘命令面板（⌘K）

## 参与

见 [CONTRIBUTING.md](CONTRIBUTING.md)。安全相关问题请按 [SECURITY.md](SECURITY.md) 私下报告。

第一次把仓库发到 GitHub？照 [docs/PUBLISH-TO-GITHUB.md](docs/PUBLISH-TO-GITHUB.md) 走一遍，或用 `bash scripts/publish.sh`。

设计过程与决策记录在 [docs/DESIGN.md](docs/DESIGN.md)，架构说明在 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## License

[MIT](LICENSE)
