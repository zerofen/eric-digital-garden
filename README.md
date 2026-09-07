# Eric's Garden · 个人静态博客

奶白底色、青绿色点缀、超大衬线标题和圆形头像。参考用户提供的 Callan 首页截图重新实现，未使用参考站的头像、音乐或内容。页面使用普通链接直接跳转。

公开页面生成纯静态 HTML，文章直达、刷新和无 JavaScript 阅读都可用。Cloudflare Worker 只处理管理员 API，并把其余请求交给静态资源。字体随站点托管，构建环境为 **Node.js 24 + npm**。

## 本地打开

安装 Node.js 24 后，在这个文件夹执行（PowerShell 如果限制运行 npm.ps1，可以用 npm.cmd）：

```bash
npm ci
npm run dev
```

打开终端显示的本地地址。已有 Node.js 24 时不需要 Python 虚拟环境。如果使用 nvm，请先切换到 Node.js 24。

检查正式部署版本：

```bash
npm run check
npm test
npm run build
npm run preview
```

预览地址为 `http://127.0.0.1:4173/`。部署只需要 **`dist/client`** 目录，不能上传整个 `dist` 或项目源码作为静态文件。

## 修改名称、头像和首页

打开 `content/site.json`。以下设置集中在这里：

| 配置                           | 用途                                   |
| ------------------------------ | -------------------------------------- |
| `name`                         | 导航、作者与页脚名字                   |
| `title`                        | 浏览器标签页标题                       |
| `headline`                     | 首页大标题，例如 `HI, I'M ERIC`        |
| `greeting` / `motto` / `intro` | 问候语、座右铭和介绍                   |
| `avatar` / `avatarAlt`         | 头像路径和图片说明                     |
| `url`                          | 域名，已设置为 `https://eric.sryze.cc` |

**换头像：**把照片放进 `public/avatar.jpg`，然后把 `avatar` 改为 `/avatar.jpg`。建议使用方形图片。当前头像是 E 字母标记，没有填写学校或个人履历。

`headline` 和 `name` 是独立的设置，更换名字时也可以一起调整首页英文标题。修改 JSON 后保留逗号与双引号的正确格式。

## 写一篇文章

```bash
npm run new-post -- my-first-post "我的第一篇文章"
```

生成的文件在 `content/posts/my-first-post.md`，默认是草稿。也可以直接在 GitHub 网页上通过 **Add file → Create new file** 创建这个路径，无需本地环境。

```markdown
---
title: '我的第一篇文章'
description: '用一两句话介绍文章。'
date: '2026-09-07'
tags: ['学习', '生活']
draft: false
---

正文从这里开始，可以用 **加粗**、链接、图片、表格和代码块。

## 一个小标题

继续写下你的想法。
```

- 文件名使用小写英文、数字和短横线。它决定文章地址，如 `/posts/my-first-post/`。
- 日期必须使用带引号的 `YYYY-MM-DD`。列表按日期从新到旧排列。
- `draft: true` 的文章不会出现在网站、RSS、站点地图或静态文章页面中。
- 自己的文章不需要 `example` 字段；现有三篇文章含 `example: true`，可自由修改或删除。
- 图片放在 `public/images/`，文中使用 `![说明](/images/photo.jpg)`。
- 改动文章后保存，开发页面可刷新读取；发布环境需重新构建。连接 Git 后提交会自动触发部署。

## 管理员模式

连续点击左上角头像五次会打开管理员登录。登录后可以新建、编辑和删除 Markdown 文章；每次操作都会通过 Cloudflare Worker 调用 GitHub Contents API，形成可恢复的 Git 提交。Cloudflare Workers Builds 检测到提交后会重新构建网站。

管理员密码不会进入浏览器脚本或 Git 仓库。以下三项必须在 Cloudflare Worker 的 **Settings → Variables and Secrets** 中设置为加密 Secret：

| Secret           | 用途                                                   |
| ---------------- | ------------------------------------------------------ |
| `ADMIN_PASSWORD` | 管理员登录密码                                         |
| `SESSION_SECRET` | 至少 32 字节的随机会话签名密钥                         |
| `GITHUB_TOKEN`   | 仅允许写入本仓库 Contents 的 GitHub fine-grained token |

仓库坐标和分支位于 `cloudflare/wrangler.jsonc` 的普通环境变量中。管理员登录使用四小时有效的 HttpOnly、SameSite 会话 Cookie；写操作校验同源请求、文件名、文章大小和必需 frontmatter。

## 更新项目、书架、音乐、此刻

编辑 `content/collections.json` 对应的数组。下面是格式示例，请替换为自己的真实内容：

```json
{
  "projects": [
    {
      "title": "项目名称",
      "description": "项目介绍",
      "tags": ["工具"],
      "status": "持续维护",
      "url": "https://example.com"
    }
  ],
  "books": [
    {
      "title": "书名",
      "author": "作者",
      "status": "在读",
      "note": "我的阅读笔记"
    }
  ],
  "music": [
    {
      "title": "歌名",
      "artist": "歌手",
      "note": "喜欢它的原因",
      "url": "https://example.com"
    }
  ],
  "moments": [{ "date": "2026-09-07", "text": "今天值得记住的一句话。" }]
}
```

链接是可选的。音乐可填写外部收听链接；如果有可使用的音频文件，放入 `public/audio/` 并加 `"audio": "/audio/song.mp3"`，页面会显示播放器，不自动播放。没有音源时不显示虚假播放按钮。当前项目、书架和音乐为空，添加条目后会自动展示并更新首页数字。

## Cloudflare Worker + GitHub 部署

1. 把本文件夹推送到 GitHub 公共仓库 `zerofen/eric-digital-garden`，默认分支为 `main`。
2. 在 Cloudflare **Workers & Pages** 中选择从 GitHub 导入仓库，创建 Workers Build。
3. 构建命令填写 `npm run build`，部署命令填写 `npm run deploy`，Node.js 版本使用 24。
4. 在 Worker 中配置上面的三个 Secret。GitHub token 只授予 `eric-digital-garden` 仓库的 **Contents: Read and write** 权限。
5. Workers Builds 每次检测到 `main` 分支提交后都会构建并执行 `wrangler deploy`。
6. `cloudflare/wrangler.jsonc` 已把 Worker 自定义域设为 `eric.sryze.cc`；首次部署时 Cloudflare 会创建或接管对应 DNS 记录。

本地验证 Worker 打包时，先执行 `npm run build`，然后运行 `npx wrangler deploy --dry-run --config cloudflare/wrangler.jsonc`。完整的本地管理员预览需要在忽略提交的 `.dev.vars` 中配置同名变量，再运行 `npm run admin:dev`。

## 内容与生成结果

```text
content/site.json          个人信息和首页文案
content/posts/*.md         Markdown 文章
content/collections.json   项目、书架、音乐、此刻
public/                   图片、音频、图标
app/                      页面与全站样式
lib/content.mjs            内容读取、校验与 Markdown 清理
scripts/                  写文章、静态预览和构建检查
.github/workflows/         GitHub 自动检查
cloudflare/                Worker 部署配置
worker/                    管理员 API 与 GitHub 写入逻辑
dist/client/              构建后的静态发布目录
```

生成流程自动维护 RSS、站点地图、robots.txt 和 CNAME。`npm run build` 会在构建前检查内容格式，构建后检查页面、内部链接、图片、字体、404 和草稿是否正确输出。Markdown 原始 HTML 会被清理，不允许注入脚本。

本项目已准备部署配置；创建远程仓库、关联 Cloudflare 项目、修改真实 DNS 与正式上线，需在自己的对应账户中完成。
