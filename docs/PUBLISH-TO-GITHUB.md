# 把 second mind 发布到 GitHub

从零到仓库上线，一步一条命令。遇到报错直接跳到最后的[报错对照表](#常见报错对照表)。

---

## 你现在的状态

我先检查过这台机器，情况如下：

| 项                 | 状态                                   |
| ----------------- | ------------------------------------ |
| git               | 已安装，2.54.0（Apple Git-157）            |
| 本地仓库              | 已初始化，分支 `main`，1 次提交 `afce5e3`       |
| 工作区               | 干净，没有未提交的改动                          |
| 远端 remote         | **没有**，这是唯一缺的一环                      |
| GitHub CLI (`gh`) | 未安装（不影响，本教程不用它）                      |
| SSH 密钥            | 没有（用 HTTPS + 令牌更省事，见下）               |
| 提交身份              | `Lv Ke <2501005857@qq.com>`          |
| 网络                | github.com 的 HTTPS 与 SSH 22 / 443 都通 |

也就是说：**你只差「建一个空仓库 + 配一次认证 + 推一次」**。

---

## 第 1 步：在 GitHub 上建空仓库

1. 浏览器打开 <https://github.com/new>（没登录先登录）。
2. 填写：
   - **Repository name**：`second-mind`
   - **Description**（可选）：`A neuronal second brain: identity keywords as first-class neurons.`
   - 选 **Public**（想看的人多就公开；想先私藏选 Private，之后能改）。注意：公开仓库允许他人查看与 Fork，这是 GitHub 平台层面的规则，许可证只能约束 Fork 之后的**使用**，挡不住 Fork 这个动作。详见 [LICENSING.md](LICENSING.md)。
3. **下面三个勾全部不要勾**：
   - ☐ Add a README file
   - ☐ Add .gitignore
   - ☐ Choose a license
   > 为什么：勾了就会在远端产生一个提交，你推上去时会因为"历史不一致"被拒绝。本项目这些文件都已经在本地仓库里了。
4. 点 **Create repository**。
5. 创建成功后会出现一个 "Quick setup" 页面，**不要照着它点**，直接回来做第 2 步。

---

## 第 2 步：让本地仓库知道推到哪

在 `second-mind` 目录里执行（把 `<你的账号>` 换成你的 GitHub 用户名）：

```bash
cd /Users/lvke/WorkBuddy/2026-11-21-15-14-51
git remote add origin https://github.com/Luca-Lv/second-mind.git
```

验证：

```bash
git remote -v
# origin  https://github.com/<你的账号>/second-mind.git (fetch)
# origin  https://github.com/<你的账号>/second-mind.git (push)
```

---

## 第 3 步：准备认证（关键，90% 的人卡在这）

**GitHub 从 2021 年 8 月起不接受账号密码。** 推代码时让你输的"密码"必须是 **Personal Access Token（令牌）**。

### 3.1 生成令牌

1. 打开 <https://github.com/settings/tokens>（头像 → Settings → Developer settings → Personal access tokens → **Tokens (classic)**）
2. 点 **Generate new token** → **Generate new token (classic)**
3. 填写：
   - **Note**：`second-mind 推送`
   - **Expiration**：`90 days`（到期再生成一个就行）
   - **Select scopes**：勾 **`repo`**（整块勾上，包含下面所有子项）**和 `workflow`**
4. 拉到最下面点 **Generate token**
5. 页面上会出现一串 `ghp_xxxxxxxx...`，**只显示这一次**，现在复制下来存好（关掉页面就再也看不到）。

> **`workflow` 这个勾不能省。** 本仓库含 `.github/workflows/ci.yml`，而 GitHub 规定：用没有 `workflow` 权限的令牌推送或修改 workflow 文件，会在对象全部上传完成之后被拒，报
> `refusing to allow a Personal Access Token to create or update workflow ... without 'workflow' scope`。
> 这个报错的迷惑之处在于前面所有步骤都显示成功（`Writing objects: 100%`、`Resolving deltas: 100%`），只在最后更新分支指针时失败。漏勾了只能重新生成令牌，权限不能事后追加。

> 更细粒度的做法：用 **Fine-grained tokens**，Repository access 选 `Only select repositories` → `second-mind`，Permissions → **Contents: Read and write** + **Workflows: Read and write**（Metadata 会自动带上）。安全性更好，但步骤多，第一次建议先用上面的 classic 令牌把流程跑通。

### 3.2 让 macOS 记住它（强烈建议）

```bash
git config --global credential.helper osxkeychain
```

这样你只需要输入一次令牌，之后会存进「钥匙串」，以后 `git push` 不再问。

**换了新令牌、但 git 还在用旧的怎么办？** 钥匙串会一直把旧令牌递上去，此时现象是「我明明重新生成了令牌，报错却一模一样」。先删掉旧记录，下一次 push 才会重新问你要令牌：

```bash
printf "protocol=https\nhost=github.com\n\n" | git credential-osxkeychain erase
git push -u origin main
```

删完可以用下面这条确认已经清掉（没有输出就是清掉了）：

```bash
printf "protocol=https\nhost=github.com\n\n" | git credential-osxkeychain get
```

更省事的替代：直接在「钥匙串访问」App 里搜索 `github.com`，把那条 `Internet password` 删掉。

### 3.3 如果你更想用 SSH（一次配置，永久免密）

跳过 3.1 / 3.2，改成：

```bash
ssh-keygen -t ed25519 -C "2501005857@qq.com"     # 一路回车，密码可留空
pbcopy < ~/.ssh/id_ed25519.pub                   # 公钥已复制到剪贴板
```

然后：GitHub → 右上头像 → **Settings** → **SSH and GPG keys** → **New SSH key** → Title 随便写 → Key 里粘贴 → **Add SSH key**。

验证：

```bash
ssh -T git@github.com
# Hi <你的账号>! You've successfully authenticated, ...
```

成功就把 remote 换成 SSH 形式：

```bash
git remote set-url origin git@github.com:<你的账号>/second-mind.git
```

> 如果公司网络封了 22 端口（表现为 `ssh: connect to host github.com port 22: Connection timed out`），在 `~/.ssh/config` 里加：
>
> ```
> Host github.com
>   HostName ssh.github.com
>   Port 443
>   User git
> ```

---

## 第 4 步：推送

```bash
git push -u origin main
```

第一次会提示：

```
Username for 'https://github.com': 你的 GitHub 用户名
Password for 'https://你的用户名@github.com': 粘贴令牌（输入时不显示，粘贴后直接回车）
```

成功的输出大致是：

```
Enumerating objects: 52, done.
...
To https://github.com/<你的账号>/second-mind.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main'.
```

刷新 `https://github.com/<你的账号>/second-mind`，应该能看到 48 个文件、README 正常渲染、右侧显示 `View license`（自定义许可不会显示成 MIT / Apache 那种标准名称，这是正常的）。

> `-u` 的意思是记住"本地 main 对应远端 origin/main"，之后直接 `git push` 就行，不用再写参数。

### 懒得敲？用仓库里的脚本

```bash
bash scripts/publish.sh --dry-run    # 先看它会做什么，不改任何东西
bash scripts/publish.sh              # 真正执行：检查 → 设 remote → 推送
```

脚本会先检查工作区是否干净、分支是否 main、有没有提交，任何一项不满足就停下来告诉你怎么办，不会半路失败。

---

## 第 5 步：推送之后建议做的 5 件事

1. **填 About**：仓库首页右上角齿轮 → Description 填一句话，Topics 加上  
   `second-brain` `knowledge-graph` `react` `canvas` `pkm` `identity`  
   （Topics 影响别人能不能搜到你）
2. **确认许可证被识别**：仓库首页右侧应显示 `View license`（本项目是自定义的 source-available 许可，GitHub 不会给标准名称，显示 `Unknown license` 也正常）。没有的话检查 `LICENSE` 是否在根目录。
3. **确认 Issues 开启**：Settings → General → Features → Issues 勾上。`.github/ISSUE_TEMPLATE/` 里的表单会自动生效。
4. **看 CI 有没有跑**：点 **Actions** 标签页。第一次可能需要点 "I understand my workflows, go ahead and enable them"。绿灯说明 typecheck、测试、构建都过。
5. **上线一个能点的版本**（本仓库已自带工作流，不用自己写）：
   - 仓库里已有 `.github/workflows/pages.yml`，push 到 `main` 就会自动构建并发布演示站。
   - 首次若没自动开启：Settings → **Pages** → Source 选 **GitHub Actions**，再点 Actions → Deploy demo → Run workflow。
   - 地址是 `https://<你的账号>.github.io/second-mind/`。工作流里显式清空了 `VITE_CLOUD_*`，所以线上**一定是本地模式**：数据存访客自己的浏览器，不发短信、不花钱。
   - 想要带手机号登录与跨设备同步的版本，Pages 做不到（没有后端）。需要部署到 Vercel / 自建服务器，并在**构建环境**注入 `VITE_CLOUD_ENDPOINT` 与 `VITE_CLOUD_KEY`。

---

## 关于提交署名（容易被忽略）

你现在的提交身份是 `Lv Ke <2501005857@qq.com>`。GitHub 只有在**邮箱匹配到你账号里的某个邮箱**时，才会把提交算在你名下并显示头像。

- 如果这个 QQ 邮箱就是你的 GitHub 账号邮箱 → 没问题。
- 如果不是：GitHub → Settings → **Emails** → 把该邮箱加进去并验证；或者改成 GitHub 提供的匿名邮箱：

```bash
git config user.email "12345678+<你的账号>@users.noreply.github.com"
git commit --amend --reset-author --no-edit    # 修正刚才那次提交的作者
```

> 只改 `user.email` 不会改历史提交；要改已有的提交得用 `--amend`（最后一次）或 `filter-branch`（多次，新手不建议）。

---

## 以后的日常流程

只有三条命令：

```bash
git status                     # 看改了什么
git add -A                     # 全部暂存
git commit -m "fix: 修正邻近展开的触发距离"
git push
```

改完记得自查（CI 也会跑这三条）：

```bash
npm run typecheck && npm test && npm run build
```

---

## 常见报错对照表

| 报错信息                                                                        | 原因                         | 怎么办                                                                            |
| --------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `remote origin already exists`                                              | 已经加过 remote                | `git remote set-url origin <新地址>`                                              |
| `Authentication failed` / `Support for password authentication was removed` | 输的是账号密码，不是令牌               | 重新 push，密码处粘贴 `ghp_...` 令牌                                                     |
| 一直提示认证失败，但令牌是新的                                                             | 钥匙串里存了旧密码                  | 打开「钥匙串访问」搜 `github.com` 删除对应条目，再 push                                          |
| `Permission denied (publickey)`                                             | SSH 公钥没加到 GitHub，或没加载      | `ssh -T git@github.com` 先验证；再 `ssh-add --apple-use-keychain ~/.ssh/id_ed25519` |
| `! [rejected] main -> main (fetch first)`                                   | 远端已有提交（建仓库时勾了 README）      | `git pull --rebase origin main` 然后 `git push`                                  |
| `refusing to allow a Personal Access Token to create or update workflow ... without 'workflow' scope` | 令牌没勾 `workflow`，推不了 `.github/workflows/` | 重新生成令牌勾上 `workflow`，清掉钥匙串旧凭据（见 3.2），再 push |
| `src refspec main does not match any`                                       | 本地没有 `main` 分支或没有提交        | `git branch -M main`，确认 `git log` 有提交                                          |
| `fatal: not a git repository`                                               | 不在项目目录                     | `cd /Users/lvke/WorkBuddy/2026-11-21-15-14-51`                                 |
| `RPC failed; HTTP 413` / `the remote end hung up unexpectedly`              | 单次推送体积过大                   | `git config http.postBuffer 524288000`；确认没把 `node_modules/` 提交进去               |
| `Connection timed out`                                                      | 网络到 GitHub 不通              | SSH 改走 443（见 3.3）；或设代理 `git config --global http.proxy http://127.0.0.1:7890`  |
| `LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443`   | 连接被中途掐断，多为网络抖动或代理不稳 | 直接重试；反复出现就换 SSH；也可试 `git config --global http.version HTTP/1.1` |
| `warning: LF will be replaced by CRLF`                                      | 换行符提示                      | 只是警告，macOS 上忽略即可                                                               |
| `Updates were rejected because the remote contains work...`                 | 同 `rejected (fetch first)` | 同上，先 `git pull --rebase`                                                       |

---

## 如果推错了

| 想做的事             | 命令                                                                 |
| ---------------- | ------------------------------------------------------------------ |
| 改远端地址（账号写错、仓库改名） | `git remote set-url origin <新地址>`                                  |
| 撤销最后一次提交，但保留改动   | `git reset --soft HEAD~1`                                          |
| 取消暂存某个文件         | `git restore --staged <文件>`                                        |
| 改最后一次提交的说明       | `git commit --amend -m "新说明"`（已推送则需 `git push --force-with-lease`） |
| 删除 GitHub 上的仓库   | 仓库 Settings → 最下方 Danger Zone → Delete this repository             |

> **不要**对 `main` 随意 `git push --force`。别人 clone 过的历史会错位。已经推上去的错误，最稳的做法是再提交一次修正。

---

## 安全提醒

- `.env.local`（含你的云 endpoint 与 key）已被 `.gitignore` 排除，**不要**用 `git add -f` 强行加进去。
- 提交前扫一眼：`git status` 里不该出现 `.env`、`node_modules/`、`dist/`。
- 万一真的把密钥推上去了：**先去平台吊销/轮换那个密钥**，再处理 git 历史。只删文件没用，历史里还在，且可能已被爬取。
- 令牌等同于密码，别贴进 Issue、聊天记录或截图。

---

## 一页速查

```bash
cd /Users/lvke/WorkBuddy/2026-11-21-15-14-51
git config --global credential.helper osxkeychain        # 让钥匙串记住令牌
git remote add origin https://github.com/<账号>/second-mind.git
git push -u origin main                                  # 用户名 + 令牌
```

完成。
