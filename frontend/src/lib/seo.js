import { site } from '../../site.config'

const base = site.url.replace(/\/$/, '')

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value)
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

/** 绝对地址：把 /images/a.png 补成完整 URL */
export function absolute(path) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** 统一成带结尾斜杠的地址，和预渲染出来的目录结构（/post/xxx/index.html）一致 */
function pageUrl(path) {
  const clean = path === '/' ? '/' : `/${path.replace(/^\/|\/$/g, '')}/`
  return `${base}${clean}`
}

export function setCanonical(path) {
  upsertLink('canonical', pageUrl(path))
}

export function setPageMeta({ title, description, image, type = 'website' } = {}) {
  if (title) document.title = title

  if (description) {
    upsertMeta('meta[name="description"]', { name: 'description', content: description })
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    })
  }

  if (title) {
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  }

  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type })

  if (image) {
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image })
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
  }
}

/** 文章页的结构化数据，方便搜索引擎理解作者与时间 */
export function setArticleJsonLd(post) {
  const url = pageUrl(`/post/${post.slug}`)
  // 没写日期的文章不输出 1970 年，宁可省略字段
  const published = post.date?.getTime() ? post.date.toISOString() : undefined
  const modified = post.updated?.getTime() ? post.updated.toISOString() : published

  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.summary || site.description,
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    author: { '@type': 'Person', name: site.author },
    mainEntityOfPage: url,
    ...(post.cover ? { image: absolute(post.cover) } : {}),
  })
}

export function setJsonLd(data) {
  let el = document.getElementById('page-jsonld')

  if (!data) {
    el?.remove()
    return
  }

  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = 'page-jsonld'
    document.head.appendChild(el)
  }

  el.textContent = JSON.stringify(data)
}
