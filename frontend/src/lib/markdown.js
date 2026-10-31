import { marked } from 'marked'

const base = import.meta.env.BASE_URL || '/'

marked.setOptions({
  gfm: true,
  breaks: false,
})

/**
 * 把 Markdown 渲染成 HTML。
 * 站内以 / 开头的图片、链接会补上 GitHub Pages 的子路径前缀。
 */
export function renderMarkdown(markdown) {
  const html = marked.parse(markdown || '', { async: false })
  return rewriteRootUrls(html, base)
}

function rewriteRootUrls(html, prefix) {
  if (!prefix || prefix === '/') return html
  const clean = prefix.replace(/\/$/, '')
  return html
    .replace(/(\s(?:src|href)=")\/(?!\/)/g, `$1${clean}/`)
    .replace(/(\s(?:src|href)=')\/(?!\/)/g, `$1${clean}/`)
}

/** 从 HTML 里提取 h2 / h3 生成目录 */
export function extractToc(html) {
  const items = []
  const re = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/g
  let match
  while ((match = re.exec(html))) {
    const text = match[2].replace(/<[^>]+>/g, '').trim()
    if (!text) continue
    items.push({ level: Number(match[1]), text, id: slugify(text) })
  }
  return items
}

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/["'“”‘’]/g, '')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * 按需注册高亮语言：只有文章里真的出现的语言才会被下载，
 * 避免把 highlight.js 全量语言包（~165KB）打进来。
 */
const languageLoaders = {
  javascript: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  python: () => import('highlight.js/lib/languages/python'),
  java: () => import('highlight.js/lib/languages/java'),
  bash: () => import('highlight.js/lib/languages/bash'),
  json: () => import('highlight.js/lib/languages/json'),
  css: () => import('highlight.js/lib/languages/css'),
  xml: () => import('highlight.js/lib/languages/xml'),
  sql: () => import('highlight.js/lib/languages/sql'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
}

const languageAliases = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  html: 'xml',
  vue: 'xml',
  svg: 'xml',
  yml: 'yaml',
  md: 'markdown',
}

const registered = new Set()

async function loadHighlighter(names) {
  const { default: hljs } = await import('highlight.js/lib/core')

  const wanted = [...new Set(names.map((name) => languageAliases[name] || name))].filter(
    (name) => languageLoaders[name] && !registered.has(name)
  )

  await Promise.all(
    wanted.map(async (name) => {
      const mod = await languageLoaders[name]()
      hljs.registerLanguage(name, mod.default)
      registered.add(name)
    })
  )

  return hljs
}

/**
 * 渲染后的增强处理：标题锚点、代码高亮、外链属性、代码块复制按钮。
 * 在 DOM 上做，避免依赖 marked 各版本不一致的 renderer API。
 */
export async function enhanceContent(root) {
  if (!root) return

  const headings = root.querySelectorAll('h1, h2, h3, h4')
  headings.forEach((heading) => {
    if (!heading.id) heading.id = slugify(heading.textContent || '')
    heading.classList.add('anchor-heading')
  })

  root.querySelectorAll('a[href^="http"]').forEach((link) => {
    if (!link.href.includes(location.host)) {
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
    }
  })

  // 图片懒加载：长文里的图片不必挤在首屏一起下载
  root.querySelectorAll('img').forEach((img) => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy')
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async')
  })

  const blocks = root.querySelectorAll('pre')
  if (blocks.length) {
    const declaredList = [...blocks].map((pre) => {
      const code = pre.querySelector('code')
      return (
        [...(code?.classList || [])]
          .find((name) => name.startsWith('language-'))
          ?.replace('language-', '') || ''
      )
    })

    const hljs = await loadHighlighter(declaredList.filter(Boolean))

    blocks.forEach((pre, index) => {
      const code = pre.querySelector('code')
      pre.classList.add('code-block')

      const declared = declaredList[index]
      if (code && declared) {
        const language = languageAliases[declared] || declared
        if (hljs.getLanguage(language)) {
          code.innerHTML = hljs.highlight(code.textContent, { language }).value
          code.classList.add('hljs')
        }
      }
      attachCopyButton(pre)
    })
  }
}

function attachCopyButton(pre) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'copy-btn'
  button.textContent = '复制'
  button.addEventListener('click', async () => {
    const text = pre.querySelector('code')?.innerText ?? pre.innerText
    try {
      await navigator.clipboard.writeText(text)
      button.textContent = '已复制'
    } catch {
      button.textContent = '复制失败'
    }
    setTimeout(() => {
      button.textContent = '复制'
    }, 1600)
  })
  pre.appendChild(button)
}
