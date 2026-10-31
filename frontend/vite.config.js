import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { site } from './site.config.js'

/**
 * 推断 GitHub Pages 的资源前缀：
 *   项目页  yztc.github.io/blog  → /blog/
 *   用户主页 yztc.github.io         → /
 *   自定义域名                      → /
 * 优先级：BASE_PATH 环境变量 > Actions 提供的真实仓库名 > site.config.js 里的 repo。
 */
function resolveBase(mode) {
  // 本地开发固定在根路径，省得每次都敲 /blog/
  if (mode === 'development') return '/'

  const explicit = process.env.BASE_PATH
  if (explicit) {
    if (explicit === '/') return '/'
    return `/${explicit.replace(/^\/|\/$/g, '')}/`
  }

  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || site.repo
  if (!repo || repo.endsWith('.github.io')) return '/'
  return `/${repo}/`
}

export default defineConfig(({ mode }) => ({
  base: resolveBase(mode),

  plugins: [vue(), ...(mode === 'development' ? [vueDevTools()] : [])],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 博客体积主要来自 highlight.js 的语言包，放宽阈值避免刷警告
    chunkSizeWarningLimit: 900,
  },
}))
