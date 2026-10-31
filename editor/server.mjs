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
const DRAFTS_DIR = path.join(FRONTEND, 'content', 'drafts')
const IMAGES_DIR = path.join(FRONTEND, 'public', 'images')
const CONFIG_FILE = path.join(FRONTEND, 'site.config.js')
const PORT = Number(process.env.PORT || 4310)

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']

await fs.mkdir(POSTS_DIR, { recursive: true })
await fs.mkdir(DRAFTS_DIR, { recursive: true })
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
  res.json({ title: site.title, url: site.url, categories: site.categories || [] })
})

app.get(
  '/api/proxy',
  ah(async (req, res) => {
    const port = await detectProxy({ force: req.query.force === '1' })
    res.json({ port })
  })
)

// ---------- 分类管理 ----------

function validateCategoryName(value) {
  const name = String(value ?? '').trim()
  if (!name) throw bad('分类名不能为空')
  if (name.length > 16) throw bad('分类名最多 16 个字')
  if (/['"[\]{}\r\n\t]/.test(name)) throw bad('分类名不能包含引号、括号或换行')
  return name
}

async function readCategories() {
  const text = await fs.readFile(CONFIG_FILE, 'utf8')
  const block = /categories:\s*\[([\s\S]*?)\]/.exec(text)
  if (!block) return []
  return [...block[1].matchAll(/['"]([^'"]*)['"]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
}

async function writeCategories(list) {
  const text = await fs.readFile(CONFIG_FILE, 'utf8')
  const pattern = /^([ \t]*)categories:\s*\[[\s\S]*?\][,]?$/m

  if (!pattern.test(text)) {
    throw bad('site.config.js 里的 categories 格式异常，请手动检查')
  }

  const serialized = `[${list.map((name) => `'${name}'`).join(', ')}]`
  const next = text.replace(pattern, (_, indent) => `${indent}categories: ${serialized},`)

  if (next === text) throw bad('没能写入分类配置')
  await fs.writeFile(CONFIG_FILE, next, 'utf8')
}

async function listPostFiles() {
  return (await fs.readdir(POSTS_DIR)).filter((file) => file.endsWith('.md'))
}

async function categoryCounts() {
  const counts = new Map()
  for (const file of await listPostFiles()) {
    const raw = await fs.readFile(path.join(POSTS_DIR, file), 'utf8')
    const { data } = parseFrontmatter(raw)
    const name = String(data.category || '').trim()
    if (name) counts.set(name, (counts.get(name) || 0) + 1)
  }
  return counts
}

/** 分类改名或删除时，同步迁移文章里的 category 字段 */
async function migratePosts(oldName, newName) {
  let changed = 0

  for (const file of await listPostFiles()) {
    const full = path.join(POSTS_DIR, file)
    const raw = await fs.readFile(full, 'utf8')
    const current = /^category:[ \t]*(.*)$/m.exec(raw)
    if (!current) continue

    const value = current[1].trim().replace(/^['"]|['"]$/g, '')
    if (value !== oldName) continue

    const next = newName
      ? raw.replace(/^category:.*$/m, `category: ${newName}`)
      : raw.replace(/^category:.*\r?\n/m, '')

    await fs.writeFile(full, next, 'utf8')
    changed += 1
  }

  return changed
}

app.get(
  '/api/categories',
  ah(async (req, res) => {
    const names = await readCategories()
    const counts = await categoryCounts()
    res.json({
      categories: names.map((name) => ({ name, count: counts.get(name) || 0 })),
    })
  })
)

app.post(
  '/api/categories',
  ah(async (req, res) => {
    const name = validateCategoryName(req.body?.name)
    const list = await readCategories()
    if (list.includes(name)) throw bad('这个分类已经存在')
    list.push(name)
    await writeCategories(list)
    res.json({ ok: true, categories: list })
  })
)

app.put(
  '/api/categories/:name',
  ah(async (req, res) => {
    const oldName = String(req.params.name || '')
    const newName = validateCategoryName(req.body?.name)
    const list = await readCategories()

    const index = list.indexOf(oldName)
    if (index === -1) throw bad('分类不存在', 404)
    if (newName !== oldName && list.includes(newName)) throw bad('新名称已经存在')

    list[index] = newName
    await writeCategories(list)
    const moved = await migratePosts(oldName, newName)

    res.json({ ok: true, moved, categories: list })
  })
)

app.delete(
  '/api/categories/:name',
  ah(async (req, res) => {
    const name = String(req.params.name || '')
    const list = await readCategories()
    if (!list.includes(name)) throw bad('分类不存在', 404)

    await writeCategories(list.filter((item) => item !== name))
    const cleared = await migratePosts(name, null)

    res.json({ ok: true, cleared, categories: list.filter((item) => item !== name) })
  })
)

// ---------- 文章与草稿 ----------
// 草稿和正式文章物理分开：保存只动草稿，正式文件永远停在最后一次发布的样子。

function draftPath(slug) {
  if (!SLUG_RE.test(String(slug || ''))) {
    throw bad('网址只能用小写字母、数字和连字符')
  }
  return path.join(DRAFTS_DIR, `${slug}.md`)
}

async function readMarkdown(file) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    const { data, body } = parseFrontmatter(raw)
    return {
      title: data.title || '',
      date: data.date || '',
      updated: data.updated || '',
      category: data.category || '',
      summary: data.summary || '',
      body,
      raw,
    }
  } catch {
    return null
  }
}

function buildMarkdown({ title, date, updated, category, summary, body, draft }) {
  const lines = ['---', `title: ${yamlValue(title)}`, `date: ${date || today()}`]
  if (updated) lines.push(`updated: ${updated}`)
  if (category) lines.push(`category: ${yamlValue(category)}`)
  if (summary) lines.push(`summary: ${yamlValue(summary)}`)
  if (draft) lines.push('draft: true')
  lines.push('---', '')

  return lines.join('\n') + (body || '')
}

function toPublic(slug, entry) {
  if (!entry) return null
  return {
    slug,
    title: entry.title,
    date: entry.date,
    updated: entry.updated,
    category: entry.category,
    summary: entry.summary,
    body: entry.body,
  }
}

async function listSlugs(dir) {
  try {
    return (await fs.readdir(dir))
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
  } catch {
    return []
  }
}

app.get(
  '/api/posts',
  ah(async (req, res) => {
    const publishedSlugs = new Set(await listSlugs(POSTS_DIR))
    const draftSlugs = new Set(await listSlugs(DRAFTS_DIR))
    const slugs = [...new Set([...publishedSlugs, ...draftSlugs])]

    const posts = await Promise.all(
      slugs.map(async (slug) => {
        const published = publishedSlugs.has(slug)
          ? await readMarkdown(path.join(POSTS_DIR, `${slug}.md`))
          : null
        const draft = draftSlugs.has(slug)
          ? await readMarkdown(path.join(DRAFTS_DIR, `${slug}.md`))
          : null
        const source = draft || published

        return {
          slug,
          title: source?.title || slug,
          date: source?.date || '',
          category: source?.category || '',
          published: Boolean(published),
          hasDraft: Boolean(draft),
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
    const slug = req.params.slug
    const published = await readMarkdown(slugPath(slug))
    const draft = await readMarkdown(draftPath(slug))

    if (!published && !draft) throw bad('文章不存在', 404)

    res.json({ slug, published: toPublic(slug, published), draft: toPublic(slug, draft) })
  })
)

// 保存草稿：只写 drafts/，正式文章不受影响
app.post(
  '/api/posts/:slug/draft',
  ah(async (req, res) => {
    const slug = req.params.slug
    const { title, date, category, summary, body } = req.body || {}

    await fs.writeFile(
      draftPath(slug),
      buildMarkdown({ title, date, category, summary, body }),
      'utf8'
    )
    res.json({ ok: true, slug })
  })
)

app.delete(
  '/api/posts/:slug/draft',
  ah(async (req, res) => {
    try {
      await fs.unlink(draftPath(req.params.slug))
    } catch {
      throw bad('没有可丢弃的草稿', 404)
    }
    res.json({ ok: true })
  })
)

app.delete(
  '/api/posts/:slug',
  ah(async (req, res) => {
    const slug = req.params.slug
    await fs.rm(slugPath(slug), { force: true })
    await fs.rm(draftPath(slug), { force: true })
    res.json({ ok: true })
  })
)

// ---------- 版本历史（来自 git，天然保留每次发布的整份文件） ----------

const HISTORY_LIMIT = 20

app.get(
  '/api/posts/:slug/history',
  ah(async (req, res) => {
    const slug = req.params.slug
    if (!SLUG_RE.test(slug)) throw bad('网址不合法')

    const relative = `frontend/content/posts/${slug}.md`
    let stdout = ''
    try {
      stdout = await git([
        'log',
        `--max-count=${HISTORY_LIMIT}`,
        '--date=iso',
        '--format=%H%x1f%ad%x1f%s',
        '--',
        relative,
      ])
    } catch {
      return res.json({ versions: [] })
    }

    const versions = stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [hash, date, message] = line.split('\x1f')
        return { hash, date, message }
      })

    res.json({ versions })
  })
)

app.get(
  '/api/posts/:slug/history/:hash',
  ah(async (req, res) => {
    const { slug, hash } = req.params
    if (!SLUG_RE.test(slug) || !/^[0-9a-f]{7,40}$/i.test(hash)) throw bad('参数不合法')

    const relative = `frontend/content/posts/${slug}.md`
    let raw = ''
    try {
      raw = await git(['show', `${hash}:${relative}`])
    } catch {
      throw bad('这个版本不存在', 404)
    }

    const { data, body } = parseFrontmatter(raw)
    res.json({
      hash,
      title: data.title || '',
      date: data.date || '',
      category: data.category || '',
      summary: data.summary || '',
      body,
    })
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
    const postFile = slugPath(slug)
    const draftFile = draftPath(slug)

    const draft = await readMarkdown(draftFile)
    const published = await readMarkdown(postFile)
    if (!draft && !published) throw bad('请先保存文章')
    if (!draft) throw bad('没有需要发布的改动')

    const changed =
      !published ||
      draft.title !== published.title ||
      draft.body !== published.body ||
      draft.category !== published.category ||
      draft.summary !== published.summary

    if (!changed) {
      await fs.rm(draftFile, { force: true })
      return res.json({ ok: true, skipped: true, message: '内容和线上一致，无需发布' })
    }

    const promoted = true
    // 发布日期锁定在第一次发布那天，之后的编辑只更新 updated，
    // 老文章不会因为改动而跳到列表最前面
    const finalDate = published?.date || draft.date || today()
    const finalUpdated = published ? today() : ''

    await fs.writeFile(
      postFile,
      buildMarkdown({
        title: draft.title,
        date: finalDate,
        updated: finalUpdated,
        category: draft.category,
        summary: draft.summary,
        body: draft.body,
      }),
      'utf8'
    )

    const relative = path.relative(ROOT, postFile).split(path.sep).join('/')
    await git(['add', '--', relative, 'frontend/public/images'])

    const status = await git(['status', '--porcelain'])
    if (status) {
      await git(['commit', '-m', message || `post: ${slug}`])
    }

    let proxy = null
    try {
      // 即使没有新提交也推一次，覆盖「上次提交成功但推送失败」的情况
      proxy = await pushWithProxy()
    } catch (err) {
      const detail = String(err.stderr || err.message || '')
      throw bad(
        '提交成功但推送失败，草稿已保留，检查 Clash 后再点一次发布。\n' + detail.slice(0, 300),
        502
      )
    }

    // 推送成功才丢弃草稿，失败时用户还能接着改
    if (draft) await fs.rm(draftFile, { force: true })

    res.json({
      ok: true,
      promoted,
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

// ---------- 启动、端口自愈与退出 ----------

const EDITOR_URL = `http://127.0.0.1:${PORT}`

async function openBrowser(target) {
  try {
    await execFileAsync('cmd', ['/c', 'start', '', target], { windowsHide: true })
  } catch {
    /* 打不开浏览器不影响服务 */
  }
}

/** 端口上跑的到底是不是写作台自己 */
async function editorAlreadyRunning() {
  try {
    const res = await fetch(`${EDITOR_URL}/api/config`, {
      signal: AbortSignal.timeout(1200),
    })
    return res.ok
  } catch {
    return false
  }
}

async function findPidOnPort(port) {
  try {
    const { stdout } = await execFileAsync('netstat', ['-ano'], { windowsHide: true })
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.includes(`:${port}`) || !/LISTENING/i.test(line)) continue
      const parts = line.trim().split(/\s+/)
      const pid = Number(parts[parts.length - 1])
      if (Number.isInteger(pid) && pid > 0) return pid
    }
  } catch {
    /* netstat 不可用 */
  }
  return null
}

async function isNodeProcess(pid) {
  try {
    const { stdout } = await execFileAsync(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { windowsHide: true }
    )
    return /node\.exe/i.test(stdout)
  } catch {
    return false
  }
}

function listenOnce() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, '127.0.0.1')
    server.once('listening', () => resolve(server))
    server.once('error', reject)
  })
}

/** 收到退出信号时先关连接，再兜底强退，避免窗口关了进程还在 */
function installShutdown(server) {
  let closing = false

  const shutdown = (signal) => {
    if (closing) return
    closing = true
    console.log(`\n  收到 ${signal}，正在退出…`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 1500).unref()
  }

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    try {
      process.on(signal, () => shutdown(signal))
    } catch {
      /* 当前平台不支持该信号 */
    }
  }
}

async function boot() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const server = await listenOnce()
      installShutdown(server)

      console.log('')
      console.log(`  写作台已启动  →  ${EDITOR_URL}`)
      console.log('')
      console.log('  关掉这个窗口即停止。')
      console.log('')

      if (!process.argv.includes('--no-open')) openBrowser(EDITOR_URL)
      return
    } catch (err) {
      if (err.code !== 'EADDRINUSE') {
        console.error(err)
        process.exit(1)
      }

      // 已经有一个写作台在跑，直接打开它，不再起第二个
      if (await editorAlreadyRunning()) {
        console.log('')
        console.log('  写作台已经在运行，直接为你打开浏览器。')
        console.log(`  ${EDITOR_URL}`)
        console.log('')
        if (!process.argv.includes('--no-open')) openBrowser(EDITOR_URL)
        process.exit(0)
      }

      const pid = await findPidOnPort(PORT)
      if (!pid || !(await isNodeProcess(pid))) {
        console.error('')
        console.error(`  端口 ${PORT} 被其他程序占用（PID ${pid ?? '未知'}），请先关闭它。`)
        console.error('')
        process.exit(1)
      }

      console.log(`  端口 ${PORT} 被上次没退干净的进程占着（PID ${pid}），正在清理…`)
      try {
        await execFileAsync('taskkill', ['/F', '/PID', String(pid)], { windowsHide: true })
      } catch {
        /* 可能它刚好自己退了 */
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }

  console.error(`  端口 ${PORT} 仍然被占用，请手动结束占用进程后重试。`)
  process.exit(1)
}

boot()
