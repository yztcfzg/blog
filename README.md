# 我的博客

一个纯静态的个人博客：Markdown 写文章，推到 GitHub 就自动发布到 GitHub Pages。

没有服务器、没有数据库、没有后台登录。文章就是仓库里的一堆 `.md` 文件。

## 特性

- **纯静态**：构建产物只有 HTML / CSS / JS，托管零成本
- **Markdown 写作**：frontmatter 管元信息，正文专注内容
- **极简排版**：680px 阅读栏宽、克制的灰阶配色、代码高亮
- **暗色模式**：跟随系统，也可手动切换（记忆在 localStorage）
- **响应式**：手机、平板、桌面都调过
- **RSS + sitemap**：构建时自动生成，不依赖第三方服务
- **hash 路由**：刷新、直接分享链接都不会 404

## 目录结构

```text
.
├── frontend/                 博客本体
│   ├── content/
│   │   ├── posts/            文章目录，一个 .md 一篇文章
│   │   └── about.md          关于页
│   ├── scripts/
│   │   ├── new-post.mjs      新建文章脚本
│   │   └── generate-feed.mjs 生成 rss/sitemap
│   ├── src/
│   │   ├── lib/              Markdown 解析与文章索引
│   │   ├── components/       页头、页脚、文章条目
│   │   ├── views/            首页、详情、归档、标签、关于
│   │   ├── styles/main.css   全部样式
│   │   └── router/
│   ├── site.config.js        ★ 站点信息都在这里
│   └── vite.config.js        自动推断 GitHub Pages 路径前缀
├── .github/workflows/deploy.yml   自动部署工作流
└── src/  pom.xml            旧的 Spring Boot 后端（已不参与博客构建）
```

## 本地开发

需要 Node 20.19+ 或 22.12+。

```bash
cd frontend
npm install
npm run dev
```

打开终端提示的地址，改代码或文章会自动热更新。

预览生产构建：

```bash
npm run build
npm run preview
```

## 写一篇文章

```bash
cd frontend
npm run new "文章标题" my-article
```

会生成 `content/posts/my-article.md`。也可以手动新建文件，文件名就是网址：

```text
content/posts/my-article.md  →  /#/post/my-article
```

文件开头的 frontmatter：

```yaml
---
title: 文章标题
date: 2026-10-31
tags: [随笔, 建站]
summary: 列表页显示的摘要，一两句话。
---
```

| 字段 | 说明 | 省略时 |
| --- | --- | --- |
| `title` | 标题 | 用文件名 |
| `date` | 发布日期，决定排序 | 1970-01-01 |
| `tags` | 标签，`[a, b]` 或分行 `- a` | 无标签 |
| `summary` | 摘要 | 自动截取正文前 110 字 |
| `draft` | `true` 则构建时跳过 | 正常发布 |

图片放在 `frontend/public/images/`，正文里写 `![说明](/images/demo.png)`，构建时会自动补上仓库子路径。

## 部署到 GitHub Pages

### 1. 推到 GitHub

```bash
git init
git add .
git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/<你的用户名>/blog.git
git push -u origin main
```

### 2. 打开 Pages

仓库 → **Settings** → **Pages** → **Build and deployment** → Source 选 **GitHub Actions**。

不需要选分支，也不需要建 `gh-pages` 分支。

### 3. 等它跑完

每次 push 到 `main`，`.github/workflows/deploy.yml` 会构建并发布，通常 1~2 分钟。

地址是：

- 项目页：`https://<用户名>.github.io/blog/`
- 用户主页（仓库名 `<用户名>.github.io`）：`https://<用户名>.github.io/`

资源前缀会从 GitHub Actions 的环境里自动推断，换仓库名也不用改代码。

### 4. 检查站点地址

`site.config.js` 里的 `url` 已经是 `https://yztcfzg.github.io/blog`，RSS 和 sitemap 用它生成绝对链接，**通常不需要额外配置**。

只有换了域名或仓库名时才需要改这里；也可以在 **Settings → Secrets and variables → Actions → Variables** 新建 `SITE_URL` 来覆盖它。

## 改成你自己的

站点信息都在 `frontend/site.config.js`：

```js
export const site = {
  title: 'yztcfzg',                                  // 站名
  author: 'yztcfzg',                                 // 署名
  description: '一个写字的地方。',
  url: 'https://yztcfzg.github.io/blog',          // 完整访问地址
  repo: 'blog',                                // 仓库名
  links: { github: 'https://github.com/yztcfzg', email: '', rss: true },
}
```

`frontend/index.html` 里的 `<title>`、`description`、`og:*` 也要同步改（首屏渲染前用的就是它们）。

关于页内容在 `frontend/content/about.md`，直接改。

## 进阶

### 绑定自定义域名

1. 在 `frontend/public/` 下建一个 `CNAME` 文件，内容写你的域名（如 `blog.example.com`），不要带 `https://`
2. DNS 添加 CNAME 记录指向 `<用户名>.github.io`
3. 仓库 Settings → Pages → Custom domain 填域名并勾选 Enforce HTTPS

因为 base 会变成 `/`，不需要改构建配置。

### 换成 history 模式（去掉 URL 里的 #）

hash 模式是为了在纯静态托管上避免 404。如果你更在意 URL 好看，可以：

1. `src/router/index.js` 里把 `createWebHashHistory()` 换成 `createWebHistory(import.meta.env.BASE_URL)`
2. 在 `vite.config.js` 里加一个插件，构建结束后把 `dist/index.html` 复制成 `dist/404.html`
3. `generate-feed.mjs` 里 `postUrl` 改成 `${siteUrl}${base}post/${slug}`

代价：直接访问深层链接会先返回 404 状态码再由前端接管，对 SEO 不友好。

### 关于原来的 Spring Boot 后端

根目录的 `src/` 和 `pom.xml` 是改造前的版本（Spring Boot + 文件存储），现在博客完全不依赖它，GitHub Pages 也跑不了 Java。留着不影响构建，想彻底清理可以删掉 `src/`、`pom.xml`、`blog_data.json` 和 `target/`。
