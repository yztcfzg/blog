/**
 * 极简 frontmatter 解析器。
 * 只支持博客常用的几种写法，刻意不引入 js-yaml，省掉 30KB 和 Buffer 兼容问题。
 *
 * ---
 * title: 标题
 * date: 2026-10-31
 * tags: [随笔, 建站]
 * summary: 摘要
 * draft: false
 * ---
 */
export function parseFrontmatter(raw) {
  const src = String(raw).replace(/^\uFEFF/, '')
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src)

  if (!match) return { data: {}, body: src }

  const data = {}
  let currentKey = null

  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // 列表项：  - 值
    const listItem = /^-\s+(.*)$/.exec(trimmed)
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) {
        data[currentKey] = data[currentKey] ? [data[currentKey]] : []
      }
      data[currentKey].push(unquote(listItem[1]))
      continue
    }

    // 键值对： key: value
    const pair = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(trimmed)
    if (pair) {
      currentKey = pair[1]
      const value = pair[2].trim()

      if (!value) {
        data[currentKey] = ''
      } else if (/^\[.*\]$/.test(value)) {
        data[currentKey] = value
          .slice(1, -1)
          .split(',')
          .map((item) => unquote(item.trim()))
          .filter(Boolean)
      } else {
        data[currentKey] = unquote(value)
      }
    }
  }

  return { data, body: src.slice(match[0].length) }
}

/**
 * 去掉引号。写作台写入时会用 JSON.stringify 转义含特殊字符的值，
 * 所以双引号包裹的值要先按 JSON 规则还原（\\" → "、\\n → 换行），
 * 手写的双引号值若不符合 JSON 规则，退回到简单的去引号。
 */
function unquote(value) {
  const text = value.trim()

  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    try {
      return JSON.parse(text)
    } catch {
      return text.slice(1, -1)
    }
  }

  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) {
    return text.slice(1, -1)
  }

  return text
}

const DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2}))?/

/** 解析 YYYY-MM-DD 或 YYYY-MM-DD HH:mm，按本地时区处理，避免 UTC 偏移导致日期差一天 */
export function parseDate(value) {
  if (value instanceof Date) return value

  const match = DATE_RE.exec(String(value || '').trim())
  if (!match) return new Date(0)

  const [, y, m, d, hh = '0', mm = '0'] = match
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm))
}

export function formatDate(date) {
  // 没有写日期时返回空串，而不是 1970-01-01
  if (!(date instanceof Date) && !DATE_RE.test(String(date ?? '').trim())) return ''

  const d = parseDate(date)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 中文环境的相对时间，列表里比绝对日期更有温度 */
export function relativeDate(date) {
  const d = parseDate(date)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days < 0) return formatDate(d)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return `${days} 天前`
  if (days < 365) return `${Math.floor(days / 30)} 个月前`
  return `${Math.floor(days / 365)} 年前`
}
