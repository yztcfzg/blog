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
  proxyInfo: $('proxyInfo'),
  categoryBtn: $('categoryBtn'),
  categoryDialog: $('categoryDialog'),
  categoryRows: $('categoryRows'),
  newCategoryInput: $('newCategoryInput'),
  addCategoryBtn: $('addCategoryBtn'),
  openSiteBtn: $('openSiteBtn'),
  saveState: $('saveState'),
  docState: $('docState'),
  historyBtn: $('historyBtn'),
  discardBtn: $('discardBtn'),
  deleteBtn: $('deleteBtn'),
  historyDialog: $('historyDialog'),
  historyList: $('historyList'),
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
  hasDraft: false,
  published: false,
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

async function refreshProxy(force = false) {
  try {
    const data = await api(`/api/proxy${force ? '?force=1' : ''}`)
    if (data.port) {
      els.proxyInfo.textContent = `代理 ${data.port}`
      els.proxyInfo.title = `发布时经由 127.0.0.1:${data.port} 访问 GitHub`
    } else {
      els.proxyInfo.textContent = '直连'
      els.proxyInfo.title = '没有检测到可用代理，发布时会尝试直连'
    }
  } catch {
    els.proxyInfo.textContent = ''
  }
}

// ---------- 分类 ----------

async function refreshCategories() {
  const data = await api('/api/categories')
  state.categories = (data.categories || []).map((item) => item.name)

  const current = els.category.value
  // 文章上的分类可能已经不在站点配置里（改过配置、手动改过 md），
  // 先留成临时选项，否则下拉框会退回「未分类」，下次保存就把分类清掉了
  const extra = current && !state.categories.includes(current) ? [current] : []

  els.category.innerHTML = [
    '<option value="">未分类</option>',
    ...[...extra, ...state.categories].map(
      (name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
    ),
  ].join('')

  els.category.value = current
}

/** 设置分类；配置里没有的分类临时补进下拉框，避免静默丢失 */
function setCategory(value) {
  const name = String(value || '')

  if (name && ![...els.category.options].some((option) => option.value === name)) {
    const option = document.createElement('option')
    option.value = name
    option.textContent = name
    els.category.appendChild(option)
  }

  els.category.value = name
}

/** 新建文章时清掉为历史文章临时补上的分类选项 */
function pruneCategoryOptions() {
  for (const option of [...els.category.options]) {
    if (option.value && !state.categories.includes(option.value) && option.value !== els.category.value) {
      option.remove()
    }
  }
}

async function renderCategoryRows() {
  const data = await api('/api/categories')
  const categories = data.categories || []

  if (!categories.length) {
    els.categoryRows.innerHTML = '<p class="sidebar__empty">还没有分类</p>'
    return
  }

  els.categoryRows.innerHTML = categories
    .map(
      (item) => `
      <div class="cat-row" data-name="${escapeHtml(item.name)}">
        <input class="cat-row__input" value="${escapeHtml(item.name)}" maxlength="16" />
        <span class="cat-row__count">${item.count} 篇</span>
        <button class="cat-row__del" data-name="${escapeHtml(item.name)}">删除</button>
      </div>`
    )
    .join('')
}

async function openCategoryDialog() {
  await renderCategoryRows()
  els.categoryDialog.showModal()
  els.newCategoryInput.focus()
}

async function addCategory() {
  const name = els.newCategoryInput.value.trim()
  if (!name) return

  try {
    await api('/api/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    els.newCategoryInput.value = ''
    await renderCategoryRows()
    await refreshCategories()
    setStatus(`已添加分类「${name}」`, 'ok')
  } catch (err) {
    setStatus(err.message, 'error')
  }
}

async function renameCategory(row, input) {
  const oldName = row.dataset.name
  const newName = input.value.trim()

  if (!newName || newName === oldName) {
    input.value = oldName
    return
  }

  // 当前文章正用着这个分类时，改名后要跟着切过去
  const wasCurrent = els.category.value === oldName

  try {
    await api(`/api/categories/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })

    await renderCategoryRows()
    await refreshCategories()
    if (wasCurrent) els.category.value = newName
    await refreshList()

    setStatus(`「${oldName}」已改名为「${newName}」`, 'ok')
  } catch (err) {
    setStatus(err.message, 'error')
    input.value = oldName
  }
}

async function deleteCategory(name) {
  if (!confirm(`删除分类「${name}」？\n\n该分类下的文章会保留，但变成未分类。`)) return

  try {
    const data = await api(`/api/categories/${encodeURIComponent(name)}`, { method: 'DELETE' })
    await renderCategoryRows()
    await refreshCategories()
    await refreshList()
    setStatus(`已删除分类「${name}」，${data.cleared} 篇文章变为未分类`, 'ok')
  } catch (err) {
    setStatus(err.message, 'error')
  }
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
          ${post.hasDraft ? '<span>草稿</span>' : ''}
        </span>
      </button>`
    )
    .join('')
}

// ---------- 草稿 ----------
// 草稿写 content/drafts/，正式文章只在「发布」时被覆盖，
// 所以再怎么改、怎么存，线上内容都停在最后一次发布的样子。

function currentPayload() {
  return {
    title: els.title.value.trim(),
    date: els.date.value || todayISO(),
    category: els.category.value,
    summary: els.summary.value.trim(),
    body: els.source.value,
  }
}

function updateDocState() {
  const el = els.docState

  if (state.hasDraft) {
    el.textContent = state.published ? '有未发布的改动' : '未发布'
    el.className = 'doc-state is-draft'
  } else if (state.published) {
    el.textContent = '已发布'
    el.className = 'doc-state is-published'
  } else {
    el.textContent = '新文章'
    el.className = 'doc-state'
  }

  els.discardBtn.hidden = !(state.hasDraft && state.published)
  // 只有线上存在的文章、或已有草稿的文章才谈得上删除
  els.deleteBtn.hidden = !(state.published || state.hasDraft)
}

/**
 * 把编辑器内容写成草稿文件。
 * quiet=true 时不打扰用户（实时保存、切换文章时用），也不刷新列表。
 */
async function persistDraft({ quiet = false, refresh = null } = {}) {
  const slug = els.slug.value.trim()

  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    if (!quiet) setStatus('网址只能用小写字母、数字和连字符', 'error')
    return false
  }

  try {
    await api(`/api/posts/${encodeURIComponent(slug)}/draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(currentPayload()),
    })

    state.slug = slug
    state.dirty = false
    state.hasDraft = true
    setSaveState('')
    updateDocState()

    // 侧栏数据跟着更新，否则连着新建两篇没写标题的文章会算出同一个网址，
    // 第二篇的自动保存会把第一篇的草稿覆盖掉
    const payload = currentPayload()
    const known = state.posts.find((item) => item.slug === slug)

    if (known) {
      known.title = payload.title || known.title
      known.date = payload.date
      known.category = payload.category
      known.hasDraft = true
    } else {
      state.posts.unshift({
        slug,
        title: payload.title || slug,
        date: payload.date,
        category: payload.category,
        published: false,
        hasDraft: true,
      })
    }

    if (refresh ?? !quiet) await refreshList()
    else renderList()
    if (!quiet) setStatus('草稿已保存', 'ok')
    return true
  } catch (err) {
    if (!quiet) setStatus(err.message, 'error')
    return false
  }
}

// ---------- 打开 / 新建 ----------

async function openPost(slug, { skipConfirm = false } = {}) {
  if (state.dirty && !skipConfirm) {
    if (!confirm('当前修改还没保存，确定切换吗？')) return
    await persistDraft({ quiet: true })
  }

  const data = await api(`/api/posts/${encodeURIComponent(slug)}`)
  // 有草稿就打开草稿，没有就打开线上版本
  const source = data.draft || data.published

  state.slug = data.slug
  state.dirty = false
  state.hasDraft = Boolean(data.draft)
  state.published = Boolean(data.published)

  els.title.value = source?.title || ''
  els.date.value = source?.date || todayISO()
  // 已发布的文章锁定发布日期，避免旧文章因为改动跳到列表最前面
  els.date.disabled = Boolean(data.published)
  els.date.title = data.published
    ? '发布日期在首次发布后固定，之后的修改只会更新「更新于」'
    : ''
  setCategory(source?.category || '')
  els.slug.value = data.slug
  els.summary.value = source?.summary || ''
  els.source.value = source?.body || ''

  location.hash = data.slug
  setSaveState('')
  updateDocState()
  renderList()
  renderPreview()
  updateCount()
}

async function newPost() {
  if (state.dirty) {
    if (!confirm('当前修改还没保存，确定新建吗？')) return
    await persistDraft({ quiet: true })
  }

  state.slug = ''
  state.dirty = false
  state.hasDraft = false
  state.published = false
  slugAutoValue = ''

  els.title.value = ''
  els.date.value = todayISO()
  els.date.disabled = false
  els.date.title = ''
  els.category.value = state.categories[0] || ''
  pruneCategoryOptions()
  els.summary.value = ''
  els.source.value = ''
  els.slug.value = uniqueSlug(`post-${todayISO().replace(/-/g, '')}`)
  slugAutoValue = els.slug.value

  // 清掉 hash 但保留查询参数（?categories 之类的入口参数）
  history.replaceState(null, '', location.pathname + location.search)
  setSaveState('')
  setStatus('')
  updateDocState()
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
  setSaveState('编辑中')
  updateCount()
  schedulePreview()

  // 停下 600ms 就把草稿写进 content/drafts/，正式文章不受影响
  clearTimeout(draftTimer)
  draftTimer = setTimeout(async () => {
    if (!state.dirty) return
    const ok = await persistDraft({ quiet: true, refresh: false })
    if (ok) setSaveState('草稿已保存')
  }, 600)
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

async function save() {
  let slug = els.slug.value.trim()
  if (!slug) {
    slug = uniqueSlug(suggestSlug(els.title.value.trim()))
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

  return persistDraft({ quiet: false })
}

async function publish() {
  const title = els.title.value.trim()
  if (!title) {
    setStatus('标题不能为空', 'error')
    els.title.focus()
    return
  }

  if (!confirm(`发布《${title}》到线上？\n\n当前草稿会覆盖线上版本。`)) return

  // 先落草稿再发布：推送失败时草稿还在，重试即可
  const saved = await persistDraft({ quiet: true })
  if (!saved) return

  els.publishBtn.disabled = true
  setStatus('正在提交并推送…')

  try {
    const data = await postJSON('/api/publish', {
      slug: state.slug,
      message: `post: ${title}`,
    })

    state.hasDraft = false
    state.published = true
    state.dirty = false
    // 首次发布后发布日期就固定了，输入框跟着锁上，别让人以为还能改
    els.date.disabled = true
    els.date.title = '发布日期在首次发布后固定，之后的修改只会更新「更新于」'
    updateDocState()
    await refreshList()

    setStatus(data.message || '已发布', 'ok')

    // 日期写的是未来的话，文章要等到那天才会出现在站上
    const publishDate = els.date.value
    if (publishDate && publishDate > todayISO()) {
      setStatus(`已推送，将在 ${publishDate} 自动上线`, 'ok')
    }

    if (data.proxy) els.proxyInfo.textContent = `代理 ${data.proxy}`
  } catch (err) {
    setStatus(err.message, 'error')
  } finally {
    els.publishBtn.disabled = false
  }
}

async function discardDraft() {
  if (!state.slug) return
  if (!confirm('放弃这份草稿？编辑器会回到线上已发布的版本。')) return

  try {
    await api(`/api/posts/${encodeURIComponent(state.slug)}/draft`, { method: 'DELETE' })
    await openPost(state.slug, { skipConfirm: true })
    setStatus('已回到线上版本', 'ok')
  } catch (err) {
    setStatus(err.message, 'error')
  }
}

/** 删除文章：线上内容会一起提交推送，所以提示要比「放弃草稿」重 */
async function deletePost() {
  if (!state.slug) return

  const label = els.title.value.trim() || state.slug
  const warning = state.published
    ? `删除《${label}》？\n\n会立即提交并推送，线上 1~2 分钟后消失。\n本地文章文件和草稿都会被删掉。`
    : `删除这篇草稿《${label}》？\n\n只删本地草稿，线上没有这篇文章。`
  if (!confirm(warning)) return

  const slug = state.slug
  els.deleteBtn.disabled = true

  try {
    const data = await api(`/api/posts/${encodeURIComponent(slug)}`, { method: 'DELETE' })
    const message = data.message || '已删除'
    state.dirty = false
    await refreshList()
    await newPost()
    // newPost() 会清空状态栏，删完再把结果提示补回来
    setStatus(message, 'ok')
  } catch (err) {
    setStatus(err.message, 'error')
  } finally {
    els.deleteBtn.disabled = false
  }
}

// ---------- 历史版本 ----------

function formatHistoryDate(text) {
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function openHistory() {
  if (!state.slug) {
    setStatus('先保存一次才有历史版本', 'error')
    return
  }

  let versions = []
  try {
    const data = await api(`/api/posts/${encodeURIComponent(state.slug)}/history`)
    versions = data.versions || []
  } catch {
    versions = []
  }

  if (!versions.length) {
    els.historyList.innerHTML = '<p class="sidebar__empty">还没有发布过，没有历史版本</p>'
  } else {
    els.historyList.innerHTML = versions
      .map(
        (version) => `
        <button class="history-row" data-hash="${version.hash}">
          <span class="history-row__date">${escapeHtml(formatHistoryDate(version.date))}</span>
          <span class="history-row__msg">${escapeHtml(version.message || '（无说明）')}</span>
        </button>`
      )
      .join('')
  }

  els.historyDialog.showModal()
}

async function loadHistoryVersion(hash) {
  try {
    const version = await api(
      `/api/posts/${encodeURIComponent(state.slug)}/history/${hash}`
    )

    if (!confirm('把这个版本载入编辑器？\n\n当前内容会变成草稿，线上文章仍然不动。')) return

    els.title.value = version.title || els.title.value
    els.date.value = version.date || els.date.value
    setCategory(version.category || els.category.value)
    els.summary.value = version.summary || ''
    els.source.value = version.body || ''

    state.dirty = true
    setSaveState('已载入历史版本')
    els.historyDialog.close()
    renderPreview()
    updateCount()
    setStatus('历史版本已载入，保存后成为草稿', 'ok')
  } catch (err) {
    setStatus(err.message, 'error')
  }
}

// ---------- 事件绑定 ----------

function bind() {
  els.source.addEventListener('input', onInput)
  els.title.addEventListener('input', () => {
    state.dirty = true
    setSaveState('未保存')
    if (!state.slug && (els.slug.value === slugAutoValue || !els.slug.value)) {
      // 标题为空时 suggestSlug 会退回日期型网址，也要走一遍查重，
      // 否则同一天新建的第二篇文章会撞上第一篇的网址
      slugAutoValue = uniqueSlug(suggestSlug(els.title.value.trim()))
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

  els.categoryBtn.addEventListener('click', openCategoryDialog)
  els.addCategoryBtn.addEventListener('click', addCategory)
  els.newCategoryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addCategory()
    }
  })

  els.categoryRows.addEventListener('change', (event) => {
    const input = event.target.closest('.cat-row__input')
    if (input) renameCategory(input.closest('.cat-row'), input)
  })

  els.categoryRows.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.classList?.contains('cat-row__input')) {
      event.preventDefault()
      event.target.blur()
    }
  })

  els.categoryRows.addEventListener('click', (event) => {
    const btn = event.target.closest('.cat-row__del')
    if (btn) deleteCategory(btn.dataset.name)
  })

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

    // 页面要卸载了，用 sendBeacon 抢在关闭前把草稿发出去
    try {
      const slug = els.slug.value.trim()
      if (/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
        navigator.sendBeacon(
          `/api/posts/${encodeURIComponent(slug)}/draft`,
          new Blob([JSON.stringify(currentPayload())], { type: 'application/json' })
        )
      }
    } catch {
      /* 存不上就算了，别拦住用户 */
    }

    event.preventDefault()
    event.returnValue = ''
  })

  // 切到别的标签页 / 最小化时也立刻存一份
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state.dirty) {
      persistDraft({ quiet: true, refresh: false })
    }
  })

  els.historyBtn.addEventListener('click', openHistory)

  els.discardBtn.addEventListener('click', discardDraft)
  els.deleteBtn.addEventListener('click', deletePost)

  els.historyList.addEventListener('click', (event) => {
    const row = event.target.closest('.history-row')
    if (row) loadHistoryVersion(row.dataset.hash)
  })
}

// ---------- 启动 ----------

async function init() {
  try {
    const config = await api('/api/config')
    document.title = `${config.title} · 写作台`
    els.siteTitle.textContent = config.title

    if (config.url) {
      els.openSiteBtn.href = config.url
      els.openSiteBtn.title = config.url
    }
    await refreshCategories()
    await refreshList()

    const slug = decodeURIComponent(location.hash.slice(1))
    if (slug) {
      await openPost(slug, { skipConfirm: true })
    } else {
      newPost()
    }

    bind()
    refreshProxy()

    if (new URLSearchParams(location.search).has('categories')) {
      openCategoryDialog()
    }

    if (new URLSearchParams(location.search).has('history')) {
      openHistory()
    }
  } catch (err) {
    document.body.innerHTML = `<p style="padding:40px;font-family:sans-serif">写作台启动失败：${escapeHtml(err.message)}</p>`
  }
}

init()
