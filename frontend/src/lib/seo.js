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

export function setCanonical(path) {
  upsertLink('canonical', `${base}/#${path}`)
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
  const url = `${base}/#/post/${post.slug}`

  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.summary || site.description,
    datePublished: post.date.toISOString(),
    dateModified: (post.updated || post.date).toISOString(),
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
