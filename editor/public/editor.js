const $ = (id) => document.getElementById(id)

const els = {
  title: $('titleInput'),
  date: $('dateInput'),
  category: $('categorySelect'),
  slug: $('slugInput'),
  summary: $('summaryInput'),
  source: $('source'),
  preview: $('preview'),
  status: $('status'),
  wordCount: $('wordCount'),
  saveState: $('saveState'),
  list: $('postList'),
  fileInput: $('fileInput'),
  saveBtn: $('saveBtn'),
  publishBtn: $('publishBtn'),
  newBtn: $('newBtn'),
  siteTitle: $('siteTitle'),
}

const state = {
  slug: '',
  posts: [],
  categories: [],
  dirty: false,
}

let previewTimer = null
let draftTimer = null
let slugAutoValue = ''

// ---------- 基础 ----------

async function api(url, options = {}) {
  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`)
  return data
}

const postJSON = (url, body) =>
  api(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c])
}

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function setStatus(text, type = '') {
  els.status.textContent = text
  els.status.className = type ? `is-${type}` : ''
}

function setSaveState(text) {
  els.saveState.textContent = text
}

// ---------- 文章列表 ----------

async function refreshList() {
  const data = await api('/api/posts')
  state.posts = data.posts || []
  renderList()
}

function renderList() {
  if (!state.posts.length) {
    els.list.innerHTML = '<p class="sidebar__empty">还没有文章</p>'
    return
  }

  els.list.innerHTML = state.posts
    .map(
      (post) => `
      <button class="post-item${post.slug === state.slug ? ' is-active' : ''}" data-slug="${escapeHtml(post.slug)}">
        <span class="post-item__title">${escapeHtml(post.title)}</span>
        <span class="post-item__meta">
          ${post.date ? `<span>${escapeHtml(post.date)}</span>` : ''}
          ${post.category ? `<span>${escapeHtml(post.category)}</span>` : ''}
          ${post.draft ? '<span>草稿</span>' : ''}
        </span>
      </button>`
    )
    .join('')
}

// ---------- 草稿 ----------

const draftKey = (slug) => `blog-editor:${slug}`

function saveDraft() {
  if (!state.slug || !state.dirty) return
  try {
    localStorage.setItem(
      draftKey(state.slug),
      JSON.stringify({ body: els.source.value, title: els.title.value })
    )
  } catch {
    /* 忽略配额错误 */
  }
}

function clearDraft(slug) {
  try {
    localStorage.removeItem(draftKey(slug))
  } catch {
    /* ignore */
  }
}

// ---------- 打开 / 新建 ----------

async function openPost(slug, { skipConfirm = false } = {}) {
  if (state.dirty && !skipConfirm && !confirm('当前修改还没保存，确定切换吗？')) return

  const post = await api(`/api/posts/${encodeURIComponent(slug)}`)
  state.slug = post.slug
  state.dirty = false

  els.title.value = post.title
  els.date.value = post.date || todayISO()
  els.category.value = post.category || ''
  els.slug.value = post.slug
  els.summary.value = post.summary || ''
  els.source.value = post.body

  location.hash = post.slug
  setSaveState('')
  renderList()
  renderPreview()
  updateCount()

  requestAnimationFrame(() => {
    const raw = localStorage.getItem(draftKey(post.slug))
    if (!raw) return
    try {
      const draft = JSON.parse(raw)
      if (draft.body && draft.body !== post.body) {
        if (confirm('发现上次未保存的内容，要恢复吗？')) {
          els.source.value = draft.body
          if (draft.title) els.title.value = draft.title
          state.dirty = true
          setSaveState('已恢复草稿')
          renderPreview()
          updateCount()
        } else {
          clearDraft(post.slug)
        }
      }
    } catch {
      clearDraft(post.slug)
    }
  })
}

function newPost() {
  if (state.dirty && !confirm('当前修改还没保存，确定新建吗？')) return

  state.slug = ''
  state.dirty = false
  slugAutoValue = ''

  els.title.value = ''
  els.date.value = todayISO()
  els.category.value = state.categories[0] || ''
  els.summary.value = ''
  els.source.value = ''
  els.slug.value = uniqueSlug(`post-${todayISO().replace(/-/g, '')}`)
  slugAutoValue = els.slug.value

  history.replaceState(null, '', location.pathname)
  setSaveState('')
  setStatus('')
  renderList()
  elPreviewEmpty()
  updateCount()
  els.title.focus()
}

function elPreviewEmpty() {
  els.preview.innerHTML = ''
}

function uniqueSlug(base) {
  const used = new Set(state.posts.map((p) => p.slug))
  if (!used.has(base)) return base
  let i = 2
  while (used.has(`${base}-${i}`)) i += 1
  return `${base}-${i}`
}

function suggestSlug(title) {
  const ascii = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return ascii || `post-${todayISO().replace(/-/g, '')}`
}

// ---------- 预览与统计 ----------

function schedulePreview() {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(renderPreview, 320)
}

async function renderPreview() {
  try {
    const data = await postJSON('/api/preview', { markdown: els.source.value })
    els.preview.innerHTML = data.html
  } catch {
    /* 预览失败不打断写作 */
  }
}

function updateCount() {
  const text = els.source.value
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const words = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  els.wordCount.textContent = `${cjk + words} 字`
}

function onInput() {
  state.dirty = true
  setSaveState('未保存')
  updateCount()
  schedulePreview()

  clearTimeout(draftTimer)
  draftTimer = setTimeout(saveDraft, 1000)
}

// ---------- 编辑操作 ----------

function insert(before, after = '', placeholder = '') {
  const ta = els.source
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = ta.value.slice(start, end) || placeholder

  ta.setRangeText(before + selected + after, start, end, 'end')
  ta.focus()

  const caret = start + before.length + selected.length
  ta.setSelectionRange(caret, caret)
  onInput()
}

function prefixLines(prefix) {
  const ta = els.source
  const value = ta.value
  const start = ta.selectionStart
  const end = ta.selectionEnd

  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const block = value.slice(lineStart, lineEnd)

  const lines = block.split('\n')
  const allPrefixed = lines.every((line) => line.startsWith(prefix))
  const next = lines
    .map((line) => (allPrefixed ? line.slice(prefix.length) : prefix + line))
    .join('\n')

  ta.setRangeText(next, lineStart, lineEnd, 'end')
  ta.focus()
  onInput()
}

const commands = {
  h2: () => insert('## ', '', '标题'),
  h3: () => insert('### ', '', '标题'),
  bold: () => insert('**', '**', '加粗'),
  italic: () => insert('*', '*', '斜体'),
  quote: () => prefixLines('> '),
  ul: () => prefixLines('- '),
  ol: () => prefixLines('1. '),
  code: () => insert('```\n', '\n```', '代码'),
  link: () => insert('[', '](https://)', '链接文字'),
  image: () => els.fileInput.click(),
  hr: () => insert('\n---\n', ''),
}

function runCommand(name) {
  const fn = commands[name]
  if (fn) fn()
}

// ---------- 图片 ----------

async function uploadImage(file) {
  if (!file || !file.type.startsWith('image/')) return

  setStatus('图片上传中…')
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'x-filename': encodeURIComponent(file.name || 'image.png'),
      },
      body: file,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '上传失败')

    insert(`![图片](${data.url})`)
    setStatus('图片已插入', 'ok')
  } catch (err) {
    setStatus(err.message, 'error')
  }
}

// ---------- 保存与发布 ----------

async function save({ silent = false } = {}) {
  const title = els.title.value.trim()
  if (!title) {
    setStatus('标题不能为空', 'error')
    els.title.focus()
    return false
  }

  let slug = els.slug.value.trim()
  if (!slug) {
    slug = uniqueSlug(suggestSlug(title))
    els.slug.value = slug
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    setStatus('网址只能用小写字母、数字和连字符', 'error')
    els.slug.focus()
    return false
  }

  if (slug !== state.slug && state.posts.some((p) => p.slug === slug)) {
    setStatus('这个网址已被占用，换一个', 'error')
    els.slug.focus()
    return false
  }

  if (!silent) setStatus('保存中…')

  try {
    await postJSON('/api/posts', {
      slug,
      title,
      date: els.date.value || todayISO(),
      category: els.category.value,
      summary: els.summary.value.trim(),
      body: els.source.value,
    })

    state.slug = slug
    state.dirty = false
    location.hash = slug
    clearDraft(slug)
    setSaveState('')
    await refreshList()
    if (!silent) setStatus('已保存', 'ok')
    return true
  } catch (err) {
    setStatus(err.message, 'error')
    return false
  }
}

async function publish() {
  const title = els.title.value.trim()
  if (!title) {
    setStatus('标题不能为空', 'error')
    els.title.focus()
    return
  }

  if (!confirm(`发布《${title}》到线上？`)) return

  const ok = await save({ silent: true })
  if (!ok) return

  els.publishBtn.disabled = true
  setStatus('正在提交并推送…')

  try {
    const data = await postJSON('/api/publish', {
      slug: state.slug,
      message: `post: ${title}`,
    })
    setStatus(data.message || '已发布', 'ok')
  } catch (err) {
    setStatus(err.message, 'error')
  } finally {
    els.publishBtn.disabled = false
  }
}

// ---------- 事件绑定 ----------

function bind() {
  els.source.addEventListener('input', onInput)
  els.title.addEventListener('input', () => {
    state.dirty = true
    setSaveState('未保存')
    if (!state.slug && (els.slug.value === slugAutoValue || !els.slug.value)) {
      slugAutoValue = suggestSlug(els.title.value)
      els.slug.value = slugAutoValue
    }
  })

  els.list.addEventListener('click', (event) => {
    const item = event.target.closest('.post-item')
    if (item) openPost(item.dataset.slug)
  })

  els.newBtn.addEventListener('click', newPost)
  els.saveBtn.addEventListener('click', () => save())
  els.publishBtn.addEventListener('click', publish)

  document.querySelector('.toolbar').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-cmd]')
    if (btn) runCommand(btn.dataset.cmd)
  })

  els.fileInput.addEventListener('change', async () => {
    for (const file of Array.from(els.fileInput.files || [])) {
      await uploadImage(file)
    }
    els.fileInput.value = ''
  })

  els.source.addEventListener('paste', async (event) => {
    const items = Array.from(event.clipboardData?.items || [])
    const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'))
    if (!imageItem) return
    event.preventDefault()
    const file = imageItem.getAsFile()
    if (file) await uploadImage(file)
  })

  els.source.addEventListener('dragover', (event) => event.preventDefault())
  els.source.addEventListener('drop', async (event) => {
    const file = Array.from(event.dataTransfer?.files || []).find((f) =>
      f.type.startsWith('image/')
    )
    if (!file) return
    event.preventDefault()
    await uploadImage(file)
  })

  document.addEventListener('keydown', (event) => {
    const mod = event.ctrlKey || event.metaKey
    if (!mod) return

    const key = event.key.toLowerCase()
    if (key === 's') {
      event.preventDefault()
      save()
    } else if (key === 'b') {
      event.preventDefault()
      runCommand('bold')
    } else if (key === 'i') {
      event.preventDefault()
      runCommand('italic')
    }
  })

  window.addEventListener('hashchange', () => {
    const slug = decodeURIComponent(location.hash.slice(1))
    if (slug && slug !== state.slug) openPost(slug)
  })

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return
    event.preventDefault()
    event.returnValue = ''
  })
}

// ---------- 启动 ----------

async function init() {
  try {
    const config = await api('/api/config')
    document.title = `${config.title} · 写作台`
    els.siteTitle.textContent = config.title
    state.categories = config.categories || []

    els.category.innerHTML = [
      '<option value="">未分类</option>',
      ...state.categories.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`),
    ].join('')

    await refreshList()

    const slug = decodeURIComponent(location.hash.slice(1))
    if (slug) {
      await openPost(slug, { skipConfirm: true })
    } else {
      newPost()
    }

    bind()
  } catch (err) {
    document.body.innerHTML = `<p style="padding:40px;font-family:sans-serif">写作台启动失败：${escapeHtml(err.message)}</p>`
  }
}

init()
