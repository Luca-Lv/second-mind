#!/usr/bin/env bash
# 把当前仓库推到 GitHub。适合第一次发布：会检查状态、设置 remote、推送并给出结果链接。
#
# 用法：
#   bash scripts/publish.sh                 # 交互式，会问你用户名和仓库名
#   GH_USER=lvke bash scripts/publish.sh    # 预设用户名，仓库名默认 second-mind
#   bash scripts/publish.sh --dry-run       # 只检查与打印，不改任何东西
#
# 需要先在 GitHub 网页上建好一个**空仓库**（不要勾 README / .gitignore / license）。

set -euo pipefail

DRY=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY=1
fi

say() { printf '%s\n' "$*"; }
die() { printf '\n错误：%s\n' "$*" >&2; exit 1; }

say "== second mind · 发布到 GitHub =="

command -v git >/dev/null 2>&1 || die "没有找到 git，请先安装 Xcode 命令行工具：xcode-select --install"
git rev-parse --git-dir >/dev/null 2>&1 || die "当前目录不是 git 仓库。"

if [ -n "$(git status --porcelain)" ]; then
  say ""
  say "还有未提交的改动："
  git status --short
  die "先提交再推送：git add -A && git commit -m \"你的说明\""
fi

BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  die "当前分支是 $BRANCH，脚本按 main 推送。先执行：git branch -M main"
fi

if ! git log --oneline -1 >/dev/null 2>&1; then
  die "还没有任何提交，先 git add -A && git commit -m \"init\""
fi

USER_NAME="${GH_USER:-}"
if [ -z "$USER_NAME" ]; then
  if [ -t 0 ]; then
    printf 'GitHub 用户名: '
    read -r USER_NAME
  else
    die "非交互环境请显式传入用户名：GH_USER=<你的账号> bash scripts/publish.sh"
  fi
fi
[ -n "$USER_NAME" ] || die "用户名不能为空。"

REPO="${GH_REPO:-}"
if [ -z "$REPO" ]; then
  if [ -t 0 ]; then
    printf '仓库名 [second-mind]: '
    read -r INPUT
    REPO="${INPUT:-second-mind}"
  else
    # 非交互（脚本调用、CI）时用默认名，不要卡在等待输入上
    REPO="second-mind"
  fi
fi

REMOTE="https://github.com/$USER_NAME/$REPO.git"

say ""
say "将要推送："
say "  分支   $BRANCH"
say "  提交   $(git log --oneline -1)"
say "  远端   $REMOTE"
say ""

if [ "$DRY" = "1" ]; then
  say "（--dry-run：以上只是检查结果，没有做任何改动）"
  exit 0
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE"
  say "已更新 origin"
else
  git remote add origin "$REMOTE"
  say "已添加 origin"
fi

say ""
say "开始推送。如果弹出用户名/密码：用户名填 GitHub 用户名，密码填 Personal Access Token（不是登录密码）。"
say ""

git push -u origin "$BRANCH"

say ""
say "完成。打开： https://github.com/$USER_NAME/$REPO"
say "若 Actions 标签页没有自动运行，去 Settings → Actions → General 允许工作流。"
