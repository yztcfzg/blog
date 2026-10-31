import express from 'express'
import { marked } from 'marked'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { parseFrontmatter } from '../frontend/src/lib/frontmatter.js'
import { site } from '../frontend/site.config.js'
import { detectProxy, buildGitEnv } from './lib/proxy.mjs'

const execFileAsync = promisify(execFile)

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..')
const FRONTEND = path.join(ROOT, 'frontend')
const POSTS_DIR = path.join(FRONTEND, 'content', 'posts')
const IMAGES_DIR = path.join(FRONTEND, 'public', 'images')
const PORT = Number(process.env.PORT || 4310)

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']

await fs.mkdir(POSTS_DIR, { recursive: true })
await fs.mkdir(IMAGES_DIR, { recursive: true })

const app = express()
app.use(express.json({ limit: '4mb' }))
app.use(express.static(path.join(here, 'public')))
app.use('/images', express.static(IMAGES_DIR))
app.use('/styles', express.static(path.join(FRONTEND, 'src', 'styles')))

// ---------- 工具 ----------

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

function bad(message, status = 400) {
  const err = new Error(message)
  err.status = status
  return err
}

function slugPath(slug) {
  if (!SLUG_RE.test(String(slug || ''))) {
    throw bad('网址只能用小写字母、数字和连字符')
  }
  return path.join(POSTS_DIR, `${slug}.md`)
}

function yamlValue(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  // 含特殊字符时加引号，避免 frontmatter 解析错位
  if (/[:#[\]{}&*!|>'"%@`]/.test(text) || /^\s|\s$/.test(text)) {
    return JSON.stringify(text)
  }
  return text
}

function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function git(args, { proxy = null } = {}) {
  // 命令行 -c 优先级最高，能盖掉仓库里可能过期的 http.proxy；
  // 没有可用代理时传空值，避免沿用旧端口
  const prefix = proxy
    ? ['-c', `http.proxy=http://127.0.0.1:${proxy}`]
    : ['-c', 'http.proxy=']

  const { stdout } = await execFileAsync('git', [...prefix, ...args], {
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
    env: buildGitEnv(proxy),
  })
  return stdout.trim()
}

/** 推送：先探测代理，失败就强制重探一次（应对 Clash 重启换端口） */
async function pushWithProxy() {
  let proxy = await detectProxy()

  try {
    await git(['push'], { proxy })
  } catch (firstError) {
    const retry = await detectProxy({ force: true })
    if (!retry || retry === proxy) throw firstError
    await git(['push'], { proxy: retry })
    proxy = retry
  }

  return proxy
}

// ---------- 配置与文章 ----------

app.get('/api/config', (req, res) => {
  res.json({ title: site.title, categories: site.categories || [] })
})

app.get(
  '/api/proxy',
  ah(async (req, res) => {
    const port = await detectProxy({ force: req.query.force === '1' })
    res.json({ port })
  })
)

app.get(
  '/api/posts',
  ah(async (req, res) => {
    const files = (await fs.readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'))
    const posts = await Promise.all(
      files.map(async (file) => {
        const raw = await fs.readFile(path.join(POSTS_DIR, file), 'utf8')
        const { data } = parseFrontmatter(raw)
        return {
          slug: file.replace(/\.md$/, ''),
          title: data.title || file,
          date: data.date || '',
          category: data.category || '',
          draft: String(data.draft) === 'true',
        }
      })
    )
    posts.sort((a, b) => String(b.date).localeCompare(String(a.date)))
    res.json({ posts })
  })
)

app.get(
  '/api/posts/:slug',
  ah(async (req, res) => {
    const file = slugPath(req.params.slug)
    let raw
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch {
      throw bad('文章不存在', 404)
    }
    const { data, body } = parseFrontmatter(raw)
    res.json({
      slug: req.params.slug,
      title: data.title || '',
      date: data.date || '',
      category: data.category || '',
      summary: data.summary || '',
      draft: String(data.draft) === 'true',
      body,
    })
  })
)

app.post(
  '/api/posts',
  ah(async (req, res) => {
    const { slug, title, date, category, summary, body, draft } = req.body || {}
    const file = slugPath(slug)

    if (!String(title || '').trim()) throw bad('标题不能为空')

    const lines = ['---', `title: ${yamlValue(title)}`, `date: ${date || today()}`]
    if (category) lines.push(`category: ${yamlValue(category)}`)
    if (summary) lines.push(`summary: ${yamlValue(summary)}`)
    if (draft) lines.push('draft: true')
    lines.push('---', '')

    await fs.writeFile(file, lines.join('\n') + (body || ''), 'utf8')
    res.json({ ok: true, slug })
  })
)

app.delete(
  '/api/posts/:slug',
  ah(async (req, res) => {
    const file = slugPath(req.params.slug)
    await fs.unlink(file)
    res.json({ ok: true })
  })
)

// ---------- 预览 ----------

app.post(
  '/api/preview',
  ah(async (req, res) => {
    const html = marked.parse(String(req.body?.markdown || ''), { async: false })
    res.json({ html })
  })
)

// ---------- 图片上传 ----------

app.post(
  '/api/upload',
  express.raw({ type: '*/*', limit: '25mb' }),
  ah(async (req, res) => {
    const buffer = req.body
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw bad('没有收到文件')

    const original = decodeURIComponent(String(req.headers['x-filename'] || 'image.png'))
    const ext = (path.extname(original) || '.png').toLowerCase()
    if (!IMAGE_EXT.includes(ext)) {
      throw bad('只支持 png / jpg / gif / webp / svg')
    }

    const now = new Date()
    const folder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const dir = path.join(IMAGES_DIR, folder)
    await fs.mkdir(dir, { recursive: true })

    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`
    await fs.writeFile(path.join(dir, name), buffer)

    res.json({ url: `/images/${folder}/${name}`, name: original })
  })
)

// ---------- 发布 ----------

app.post(
  '/api/publish',
  ah(async (req, res) => {
    const { slug, message } = req.body || {}
    const file = slugPath(slug)

    try {
      await fs.access(file)
    } catch {
      throw bad('请先保存文章')
    }

    const relative = path.relative(ROOT, file).split(path.sep).join('/')
    await git(['add', '--', relative, 'frontend/public/images'])

    const status = await git(['status', '--porcelain'])
    if (!status) {
      return res.json({ ok: true, skipped: true, message: '没有需要提交的改动' })
    }

    await git(['commit', '-m', message || `post: ${slug}`])

    let proxy = null
    try {
      proxy = await pushWithProxy()
    } catch (err) {
      const detail = String(err.stderr || err.message || '')
      throw bad(
        '提交成功但推送失败，检查 Clash 是否开启后再点一次发布。\n' + detail.slice(0, 300),
        502
      )
    }

    res.json({
      ok: true,
      message: `已推送${proxy ? `（代理 ${proxy}）` : ''}，1~2 分钟后上线`,
      proxy,
    })
  })
)

// ---------- 错误处理 ----------

app.use((err, req, res, next) => {
  const status = err.status || 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: err.message || '服务器错误' })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log('')
  console.log(`  写作台已启动  →  http://127.0.0.1:${PORT}`)
  console.log('')
  console.log('  关掉这个窗口即停止。')
  console.log('')
})
