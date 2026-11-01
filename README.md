# 玉琢天晨

一个写字的地方。 <https://yztcfzg.github.io/blog/>

- `frontend/` 站点本体（Vue + Vite，构建时预渲染成独立 HTML）
- `editor/` 本地写作台，双击根目录的 `写作台.bat` 启动
- `frontend/content/posts/` 文章，`frontend/content/about.md` 关于页

## 写文章

写作台里写完点「发布」：保存草稿 → 提交 → 推送，GitHub Actions 自动重建上线。

也可以直接放一个 Markdown 到 `frontend/content/posts/`：

```yaml
---
title: 京都的雨
date: 2024-03-12
category: 旅游映像
summary: 一句话摘要
---
```

图片放 `frontend/public/images/`，正文里用 `/images/文件名` 引用。

## 本地命令

```bash
cd frontend
npm run dev             # 本地预览
npm run build           # 构建（预渲染 + RSS / sitemap）
npm run new "标题" slug 分类
```

路由用 history 模式，每篇文章构建时生成独立 HTML；GitHub Pages 靠 `404.html` 兜底未知路径。
