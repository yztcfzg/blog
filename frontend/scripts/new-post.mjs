/**
 * 新建一篇文章：npm run new "文章标题" slug-name
 * 会生成 content/posts/<slug>.md，并带上 frontmatter 模板。
 */
import { writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const postsDir = join(here, '..', 'content', 'posts')

const title = process.argv[2]

if (!title) {
  console.error('用法：npm run new "文章标题" [slug]')
  console.error('例如：npm run new "关于时间管理" time-management')
  process.exit(1)
}

const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

const fallback = `post-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
const slug = (process.argv[3] || fallback).replace(/\.md$/, '').trim()

const target = join(postsDir, `${slug}.md`)

if (existsSync(target)) {
  console.error(`文件已存在：content/posts/${slug}.md`)
  process.exit(1)
}

const template = `---
title: ${title}
date: ${date}
tags: []
summary:
---

在这里开始写。

## 小节标题

正文……
`

writeFileSync(target, template, 'utf8')
console.log(`已创建 content/posts/${slug}.md`)
console.log(`访问地址：/#/post/${slug}`)
console.log('提示：文件名就是网址，发布后不要随意改名。')
