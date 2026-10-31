import fs from 'node:fs'
import path from 'node:path'

import { parseFrontmatter, parseDate } from './src/lib/frontmatter.js'

const VIRTUAL_ID = 'virtual:blog-posts'
const RESOLVED_ID = '\0' + VIRTUAL_ID

/**
 * 构建时把文章内联进产物（和原来的 import.meta.glob 一样），
 * 但只内联真正会上线的文章：草稿和日期在未来的文章不会被打进 JS。
 *
 * 用 import.meta.glob 时所有 .md 都会进包，草稿的正文因此跟着产物公开，
 * 所以改成由插件在构建时读目录、先过滤再内联。
 */
export function postsPlugin() {
  // 默认就是 frontend/ 目录，configResolved 里会再校准一次
  let root = import.meta.dirname

  const postsDir = () => path.join(root, 'content', 'posts')

  function collect() {
    let files = []
    try {
      files = fs.readdirSync(postsDir()).filter((file) => file.endsWith('.md'))
    } catch {
      return []
    }

    const now = new Date()

    return files
      .map((file) => {
        const raw = fs.readFileSync(path.join(postsDir(), file), 'utf8')
        const { data } = parseFrontmatter(raw)
        return {
          path: file,
          date: parseDate(data.date),
          draft: String(data.draft) === 'true',
          raw,
        }
      })
      .filter((post) => !post.draft && post.date <= now)
      .sort((a, b) => b.date - a.date)
      .map((post) => ({ path: post.path, raw: post.raw }))
  }

  return {
    name: 'blog-posts',

    configResolved(config) {
      root = config.root
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
      return null
    },

    load(id) {
      if (id !== RESOLVED_ID) return null
      return `export const posts = ${JSON.stringify(collect())}\n`
    },

    configureServer(server) {
      const dir = postsDir()
      const invalidate = (file) => {
        if (!file.endsWith('.md') || !path.resolve(file).startsWith(path.resolve(dir))) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }

      server.watcher.add(dir)
      server.watcher.on('add', invalidate)
      server.watcher.on('unlink', invalidate)
      server.watcher.on('change', invalidate)
    },
  }
}
