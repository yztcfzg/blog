/**
 * 构建后生成 RSS 订阅源和 sitemap。
 * 用法：npm run build（已串联在 build 脚本里）
 * 也可单独执行：SITE_URL=https://example.com BASE_PATH=/my_blog/ node scripts/generate-feed.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter, parseDate } from '../src/lib/frontmatter.js'
import { site } from '../site.config.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const postsDir = join(root, 'content', 'posts')
const distDir = join(root, 'dist')

// SITE_URL 表示站点的完整根地址（含 GitHub Pages 子路径），例如
// https://yourname.github.io/my_blog
const siteUrl = (process.env.SITE_URL || site.url).replace(/\/$/, '')
const homeUrl = `${siteUrl}/`
const postUrl = (slug) => `${homeUrl}#/post/${slug}`

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function loadPosts() {
  if (!existsSync(postsDir)) return []

  return readdirSync(postsDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(join(postsDir, file), 'utf8')
      const { data, body } = parseFrontmatter(raw)
      const slug = data.slug || file.replace(/\.md$/, '')
      const plain = body
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[#>*_`|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      return {
        slug,
        title: data.title || slug,
        date: parseDate(data.date),
        tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
        summary: data.summary || plain.slice(0, 120),
        draft: String(data.draft) === 'true',
      }
    })
    .filter((post) => !post.draft)
    .sort((a, b) => b.date - a.date)
}

const posts = loadPosts()

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true })

// ---------- RSS 2.0 ----------
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.title)}</title>
    <link>${escapeXml(homeUrl)}</link>
    <description>${escapeXml(site.description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${homeUrl}rss.xml`)}" rel="self" type="application/rss+xml"/>
${posts
  .map(
    (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl(post.slug))}</link>
      <guid isPermaLink="true">${escapeXml(postUrl(post.slug))}</guid>
      <pubDate>${post.date.toUTCString()}</pubDate>
      <description>${escapeXml(post.summary)}</description>
${post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`).join('\n')}
    </item>`
  )
  .join('\n')}
  </channel>
</rss>
`

// ---------- sitemap ----------
const staticPages = ['', 'archive', 'tags', 'about']
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map(
    (page) => `  <url>
    <loc>${escapeXml(`${homeUrl}#/${page}`)}</loc>
  </url>`
  )
  .join('\n')}
${posts
  .map(
    (post) => `  <url>
    <loc>${escapeXml(postUrl(post.slug))}</loc>
    <lastmod>${post.date.toISOString().slice(0, 10)}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>
`

writeFileSync(join(distDir, 'rss.xml'), rss, 'utf8')
writeFileSync(join(distDir, 'sitemap.xml'), sitemap, 'utf8')
writeFileSync(join(distDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${homeUrl}sitemap.xml\n`, 'utf8')

console.log(`[feed] ${posts.length} 篇文章 → dist/rss.xml, dist/sitemap.xml, dist/robots.txt`)
