/**
 * 构建后预渲染：给每篇文章生成独立 HTML，带上自己的 title / description / OG / JSON-LD。
 *
 * 不引 puppeteer 或 SSR：站点本身就是静态的，用 marked 把正文渲染出来，
 * 塞进 vite 产物的 index.html 模板里即可。爬虫拿到的是完整内容，
 * 浏览器里 Vue 挂载后仍然接管成 SPA（createWebHistory 路由）。
 *
 * 输出：
 *   dist/index.html                     首页
 *   dist/post/<slug>/index.html         文章页
 *   dist/category/<name>/index.html     分类页
 *   dist/archive/index.html             归档
 *   dist/about/index.html               关于
 *   dist/404.html                       SPA 兜底（未知路径）
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

import { parseFrontmatter, parseDate, formatDate } from '../src/lib/frontmatter.js'
import { site } from '../site.config.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const distDir = join(root, 'dist')
const postsDir = join(root, 'content', 'posts')

const template = readFileSync(join(distDir, 'index.html'), 'utf8')

// 与 vite.config.js 的 resolveBase 保持一致：从产物里已经写好的资源前缀反推
const baseMatch = /(?:src|href)="([^"]*?)\/assets\//.exec(template)
const BASE = `${baseMatch ? baseMatch[1] : ''}/`
const SITE_URL = site.url.replace(/\/$/, '')

marked.setOptions({ gfm: true, breaks: false })

// ---------- 工具 ----------

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )

/** 站内绝对路径 → 完整 URL（site.url 已含 /blog 子路径） */
const absolute = (path) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

/** 统一带结尾斜杠的页面地址，和 dist 里的目录结构一致 */
const pageUrl = (path) => {
  const clean = path === '/' ? '/' : `/${path.replace(/^\/|\/$/g, '')}/`
  return absolute(clean)
}

const href = (path) => `${BASE}${path.replace(/^\/|\/$/g, '')}${path === '/' ? '' : '/'}`

/** 正文里的 /images/... 要补上 /blog 前缀，和运行时 rewriteRootUrls 一致 */
function rewriteRootUrls(html) {
  if (BASE === '/') return html
  const clean = BASE.replace(/\/$/, '')
  return html.replace(/(\s(?:src|href)=")\/(?!\/)/g, `$1${clean}/`)
}

/** 与 src/lib/markdown.js 的 slugify 保持一致 */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/["'“”‘’]/g, '')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function stripMarkdown(body) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/^[ \t]*\d+\.[ \t]+/gm, '')
    .replace(/[*_`>~]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readingTime(body) {
  const text = stripMarkdown(body)
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const words = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  return Math.max(1, Math.round(cjk / 400 + words / 220))
}

/** marked 不打标题 id，这里补上，静态页面里的目录锚点才能跳 */
function addHeadingIds(html) {
  return html.replace(/<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/g, (all, level, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim()
    if (!text) return all
    const id = slugify(text)
    if (!id) return all
    const cleanAttrs = attrs.replace(/\s*id="[^"]*"/g, '')
    return `<h${level}${cleanAttrs} id="${esc(id)}" class="anchor-heading">${inner}</h${level}>`
  })
}

function extractToc(html) {
  const items = []
  const re = /<h([23])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/g
  let match
  while ((match = re.exec(html))) {
    items.push({
      level: Number(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, '').trim(),
    })
  }
  return items
}

// ---------- 数据 ----------

function loadPosts() {
  if (!existsSync(postsDir)) return []

  const now = new Date()

  return readdirSync(postsDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(join(postsDir, file), 'utf8')
      const { data, body } = parseFrontmatter(raw)
      const slug = data.slug || file.replace(/\.md$/i, '')
      const plain = stripMarkdown(body)
      const date = parseDate(data.date)

      return {
        slug,
        title: data.title || slug,
        date,
        dateText: formatDate(data.date),
        updatedText: data.updated ? formatDate(data.updated) : '',
        updated: data.updated ? parseDate(data.updated) : null,
        category: data.category ? String(data.category).trim() : '',
        summary: data.summary || plain.slice(0, 110) + (plain.length > 110 ? '…' : ''),
        body,
        readingTime: readingTime(body),
        cover: data.cover ? String(data.cover).trim() : '',
        draft: String(data.draft) === 'true',
      }
    })
    .filter((post) => !post.draft && post.date <= now)
    .sort((a, b) => b.date - a.date)
}

const posts = loadPosts()

// ---------- 公共片段 ----------

const categories = site.categories || []
const year = new Date().getFullYear()

function navHtml(activePath) {
  const items = [
    { path: '/', label: '首页' },
    ...categories.map((name) => ({ path: `/category/${name}/`, label: name })),
    { path: '/about/', label: '关于' },
  ]

  return items
    .map((item) => {
      const active = item.path === activePath ? ' is-active' : ''
      return `<a href="${href(item.path)}" class="nav__link${active}">${esc(item.label)}</a>`
    })
    .join('')
}

function layout(mainHtml, activePath = '') {
  return `<header class="site-header">
  <div class="wrap site-header__inner">
    <a href="${BASE}" class="brand">${esc(site.title)}</a>
    <nav class="nav">${navHtml(activePath)}</nav>
  </div>
</header>
<main class="main">
${mainHtml}
</main>
<footer class="site-footer">
  <div class="wrap site-footer__inner">
    <span>© ${year} ${esc(site.author)}</span>
    <div class="site-footer__links"><a href="${href('/archive/')}">归档</a></div>
  </div>
</footer>`
}

function postRowHtml(post) {
  const category = post.category
    ? `<p class="post-row__category"><a href="${href(`/category/${post.category}/`)}" class="category">${esc(post.category)}</a></p>`
    : ''

  return `<article class="post-row">
  <time class="post-row__date"${post.dateText ? ` datetime="${post.dateText}"` : ''}>${esc(post.dateText)}</time>
  <div>
    <a href="${href(`/post/${post.slug}/`)}" class="post-row__link"><h2 class="post-row__title">${esc(post.title)}</h2></a>
    ${post.summary ? `<p class="post-row__summary">${esc(post.summary)}</p>` : ''}
    ${category}
  </div>
</article>`
}

function articleMetaHtml(post) {
  const parts = [
    post.dateText
      ? `<time datetime="${esc(post.dateText)}">${esc(post.dateText)}</time>`
      : '<time></time>',
    post.updatedText && post.updatedText !== post.dateText
      ? `<span class="article__meta-dot"></span><span>更新于 ${esc(post.updatedText)}</span>`
      : '',
    `<span class="article__meta-dot"></span><span>${post.readingTime} 分钟阅读</span>`,
    post.category
      ? `<span class="article__meta-dot"></span><a href="${href(`/category/${post.category}/`)}" class="category">${esc(post.category)}</a>`
      : '',
  ]

  return parts.filter(Boolean).join('')
}

// ---------- 页面 ----------

function shellHtml({ title, description, canonical, type = 'website', image, jsonld }) {
  const extra = [
    canonical ? `<link rel="canonical" href="${esc(canonical)}" />` : '',
    `<meta property="og:url" content="${esc(canonical || '')}" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    image ? '<meta name="twitter:card" content="summary_large_image" />' : '',
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
    jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ')

  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${esc(description)}" />`
    )
    .replace(
      /<meta property="og:type" content="[^"]*" \/>/,
      `<meta property="og:type" content="${type}" />`
    )
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${esc(title)}" />`
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${esc(description)}" />`
    )
    .replace('</head>', `  ${extra}\n  </head>`)
}

function pageHtml({ content, ...meta }) {
  return shellHtml(meta).replace('<div id="app"></div>', `<div id="app">${content}</div>`)
}

function writePage(relativePath, html) {
  const file = join(distDir, relativePath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html, 'utf8')
}

// 首页
const pageSize = site.pageSize > 0 ? site.pageSize : posts.length
const homeList = posts.slice(0, pageSize).map(postRowHtml).join('\n')
const homeContent = layout(
  `<div class="wrap">
  <section class="hero">
    <h1 class="hero__name">${esc(site.author)}</h1>
    <p class="hero__desc">${esc(site.description)}</p>
    ${posts.length ? `<p class="hero__meta">${posts.length} 篇文章 · 最后更新 ${esc(posts[0].dateText)}</p>` : ''}
  </section>
  ${posts.length ? `<div class="post-list">\n${homeList}\n</div>` : '<p class="empty">还没有文章。</p>'}
</div>`,
  '/'
)

writePage(
  'index.html',
  pageHtml({
    title: `${site.title} · ${site.description}`,
    description: site.description,
    canonical: pageUrl('/'),
    content: homeContent,
  })
)

// 404 兜底：用未注入内容的空壳，交给 SPA 渲染 NotFound
writePage('404.html', template)

// 文章页
for (const post of posts) {
  const bodyHtml = addHeadingIds(rewriteRootUrls(marked.parse(post.body || '', { async: false })))
  const toc = extractToc(bodyHtml)
  const tocHtml =
    toc.length >= 3
      ? `<nav class="toc" aria-label="目录">
    <div class="toc__label">目录</div>
    <ul class="toc__list">${toc
      .map(
        (item) =>
          `<li class="toc__item${item.level === 3 ? ' toc__item--3' : ''}"><a href="#${esc(item.id)}">${esc(item.text)}</a></li>`
      )
      .join('')}</ul>
  </nav>`
      : ''

  const index = posts.findIndex((item) => item.slug === post.slug)
  const prev = posts[index + 1]
  const next = posts[index - 1]
  const navHtml2 =
    prev || next
      ? `<nav class="article-nav">
    ${prev ? `<a href="${href(`/post/${prev.slug}/`)}" class="article-nav__item"><span class="article-nav__label">← 上一篇</span><span class="article-nav__title">${esc(prev.title)}</span></a>` : '<span></span>'}
    ${next ? `<a href="${href(`/post/${next.slug}/`)}" class="article-nav__item article-nav__item--next"><span class="article-nav__label">下一篇 →</span><span class="article-nav__title">${esc(next.title)}</span></a>` : ''}
  </nav>`
      : ''

  const content = layout(
    `<div class="wrap wrap--narrow">
  <a href="${BASE}" class="back-link">← 返回列表</a>
  <article class="article">
    <header>
      <h1 class="article__title">${esc(post.title)}</h1>
      <div class="article__meta">${articleMetaHtml(post)}</div>
    </header>
    ${tocHtml}
    <div class="prose">${bodyHtml}</div>
    ${navHtml2}
  </article>
</div>`,
    `/post/${post.slug}/`
  )

  const canonical = pageUrl(`/post/${post.slug}`)
  const image = post.cover ? absolute(post.cover) : ''

  writePage(
    `post/${post.slug}/index.html`,
    pageHtml({
      title: `${post.title} · ${site.title}`,
      description: post.summary || site.description,
      canonical,
      type: 'article',
      image,
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.summary || site.description,
        ...(post.dateText ? { datePublished: post.date.toISOString() } : {}),
        ...(post.dateText
          ? { dateModified: (post.updated?.getTime() ? post.updated : post.date).toISOString() }
          : {}),
        author: { '@type': 'Person', name: site.author },
        mainEntityOfPage: canonical,
        ...(image ? { image } : {}),
      },
      content,
    })
  )
}

// 分类页
for (const name of categories) {
  const list = posts.filter((post) => post.category === name)
  const content = layout(
    `<div class="wrap wrap--narrow">
  <header class="page-head">
    <h1 class="page-head__title">${esc(name)}</h1>
    ${list.length ? `<p class="page-head__desc">${list.length} 篇文章</p>` : ''}
  </header>
  ${list.length ? `<div class="post-list">\n${list.map(postRowHtml).join('\n')}\n</div>` : '<p class="empty">这个分类下还没有文章。</p>'}
</div>`,
    `/category/${name}/`
  )

  // 目录名用真实的中文分类名：GitHub Pages 会先把 URL 解码再找文件，
  // 写成 %E9%9A%8F%E7%AC%94 这种字面编码反而 404
  writePage(
    `category/${name}/index.html`,
    pageHtml({
      title: `${name} · ${site.title}`,
      description: `${name}分类下的文章，共 ${list.length} 篇。`,
      canonical: pageUrl(`/category/${encodeURIComponent(name)}`),
      content,
    })
  )
}

// 归档
const byYear = new Map()
for (const post of posts) {
  const key = post.dateText ? post.dateText.slice(0, 4) : '未标注日期'
  if (!byYear.has(key)) byYear.set(key, [])
  byYear.get(key).push(post)
}

const archiveContent = layout(
  `<div class="wrap wrap--narrow">
  <header class="page-head">
    <h1 class="page-head__title">归档</h1>
    <p class="page-head__desc">共 ${posts.length} 篇文章，按时间倒序。</p>
  </header>
  ${[...byYear.entries()]
    .map(
      ([key, list]) => `<section class="year-group">
    <div class="year-group__label">${esc(key)}</div>
    ${list
      .map(
        (post) =>
          `<a href="${href(`/post/${post.slug}/`)}" class="archive-row"><span class="archive-row__date">${post.dateText ? esc(post.dateText.slice(5)) : '—'}</span><span class="archive-row__title">${esc(post.title)}</span></a>`
      )
      .join('\n    ')}
  </section>`
    )
    .join('\n  ')}
  ${posts.length ? '' : '<p class="empty">还没有文章。</p>'}
</div>`,
  '/archive/'
)

writePage(
  'archive/index.html',
  pageHtml({
    title: `归档 · ${site.title}`,
    description: `${site.title}的全部文章，共 ${posts.length} 篇。`,
    canonical: pageUrl('/archive'),
    content: archiveContent,
  })
)

// 关于
const aboutPath = join(root, 'content', 'about.md')
const aboutBody = existsSync(aboutPath)
  ? parseFrontmatter(readFileSync(aboutPath, 'utf8')).body
  : ''
const aboutContent = layout(
  `<div class="wrap wrap--narrow">
  <article class="article">
    <div class="prose prose--about">${addHeadingIds(rewriteRootUrls(marked.parse(aboutBody, { async: false })))}</div>
  </article>
</div>`,
  '/about/'
)

writePage(
  'about/index.html',
  pageHtml({
    title: `关于 · ${site.title}`,
    description: site.description,
    canonical: pageUrl('/about'),
    content: aboutContent,
  })
)

console.log(
  `[prerender] ${posts.length} 篇文章 + 首页/归档/关于/${categories.length} 个分类 → dist（base ${BASE}）`
)
