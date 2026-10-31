---
title: 从零开始，把博客搬进 GitHub Pages
date: 2026-10-31
tags: [建站, 随笔]
summary: 一个跑在 Tomcat 里的 Spring Boot 博客，怎么变成一份纯静态文件，还顺手甩掉了服务器和数据库。
---

这个博客原本是个标准的「前后端分离」项目：Spring Boot 起一个 8080 端口的服务，Vue 前端用 `fetch` 调 `localhost:8080/api/posts`，文章存在一个叫 `blog_data.json` 的文件里。

本地跑起来没问题，但它有个致命前提——**得有人开着那台机器**。

## 为什么必须改成静态

GitHub Pages 只做一件事：把仓库里的文件当静态资源发出去。没有 JVM，没有数据库，也不接受 `POST /api/posts`。所以所有「运行时」的逻辑都得往前挪到「构建时」。

于是整个架构变成了这样：

| 原来 | 现在 |
| --- | --- |
| Quill 富文本编辑器写文章 | 用任意编辑器写 Markdown 文件 |
| POST 请求存进 JSON | 提交到 Git 仓库 |
| 浏览器请求接口拿数据 | 构建时把文章打进 JS 产物 |
| 部署需要服务器 | 推送代码，Actions 自动发布 |

写一篇新文章的流程，从「打开网页、登录、点新建、填表单」变成了「建一个 `.md` 文件、写、commit、push」。看起来更极客了，但换来的是：**文章是纯文本，永远属于你**，可以 grep、可以 diff、可以随便迁移。

## 技术栈

- **Vue 3** + `script setup`，没有引入 UI 框架，样式全是手写的 CSS
- **Vite** 负责构建，`import.meta.glob` 在编译期把 `content/posts/*.md` 全部读进来
- **marked** 做 Markdown 解析，**highlight.js** 负责代码高亮
- **vue-router** 用 hash 模式，刷新页面永远不会 404

最后一项值得多说一句。单页应用部署到 GitHub Pages，用 history 模式会遇到「直接访问 `/post/xxx` 返回 404」的经典问题，社区方案是搞一个 `404.html` 做重定向，但那会让每个页面都返回 404 状态码，对搜索引擎不友好。

hash 模式的 URL 长这样：

```text
https://cuhklyc.github.io/my_blog/#/post/hello-world
```

多了一个 `#`，但换来的是零配置、零故障、永久有效。对一个个人博客来说，这笔交易很划算。

## 关于写作

以前总想着「等我把编辑器做完善了再开始写」，结果编辑器写了一版又一版，文章一篇没有。

现在没有编辑器了，反而可以开始写了。

> 工具的上限，不该成为表达的起点。

下一篇会讲讲这个博客具体怎么用——怎么加文章、怎么写 frontmatter、图片放哪里。
