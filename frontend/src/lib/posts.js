import { parseFrontmatter, parseDate, formatDate } from './frontmatter'
import { site } from '../../site.config'
import { posts as rawPosts } from 'virtual:blog-posts'

// 构建时由 vite-plugin-posts 读取 content/posts 并内联进产物，
// 草稿和日期在未来的文章不会出现在这里（也就不会被打进 JS）。
// 新增文章：往 content/posts/ 里放一个 .md 文件即可，无需改代码。
function toSlug(file) {
  return String(file).split('/').pop().replace(/\.md$/i, '')
}

/** 去掉 Markdown 标记，用于自动生成摘要 */
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

function buildPost(path, raw) {
  const { data, body } = parseFrontmatter(raw)
  const slug = data.slug || toSlug(path)
  const plain = stripMarkdown(body)
  const summary = data.summary || plain.slice(0, 110) + (plain.length > 110 ? '…' : '')

  return {
    slug,
    title: data.title || slug,
    date: parseDate(data.date),
    dateText: formatDate(data.date),
    // 修改时间单独记录，排序始终用首次发布日期
    updated: data.updated ? parseDate(data.updated) : null,
    updatedText: data.updated ? formatDate(data.updated) : '',
    category: data.category ? String(data.category).trim() : '',
    // 封面图，用于社交分享卡片
    cover: data.cover ? String(data.cover).trim() : '',
    summary,
    body,
    readingTime: readingTime(body),
    draft: String(data.draft) === 'true',
  }
}

// 构建时刻：日期在未来的文章先不出现，等那天自动构建时才上线
const buildTime = new Date()

export const allPosts = rawPosts
  .map(({ path, raw }) => buildPost(path, raw))
  .filter((post) => !post.draft && post.date <= buildTime)
  .sort((a, b) => b.date - a.date)

export function findPost(slug) {
  return allPosts.find((post) => post.slug === slug) || null
}

export function neighbors(slug) {
  const index = allPosts.findIndex((post) => post.slug === slug)
  if (index === -1) return { prev: null, next: null }
  // 列表按时间倒序，所以 prev 是更早的一篇
  return {
    prev: allPosts[index + 1] || null,
    next: allPosts[index - 1] || null,
  }
}

/** 导航里展示的分类，顺序以 site.config.js 为准 */
export const categories = site.categories || []

export function postsByCategory(name) {
  if (!name) return allPosts
  return allPosts.filter((post) => post.category === name)
}

/** 按年份分组，用于归档页 */
export const postsByYear = (() => {
  const map = new Map()
  for (const post of allPosts) {
    // 没写日期的文章不硬塞进 1970 年
    const year = post.dateText ? post.dateText.slice(0, 4) : '未标注日期'
    if (!map.has(year)) map.set(year, [])
    map.get(year).push(post)
  }
  return [...map.entries()].sort((a, b) => (Number(b[0]) || 0) - (Number(a[0]) || 0))
})()
