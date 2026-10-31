import { createRouter, createWebHistory } from 'vue-router'
import { site } from '../../site.config'
import { setCanonical, setJsonLd, setPageMeta } from '../lib/seo'
import Home from '../views/Home.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  {
    path: '/post/:slug',
    name: 'post',
    component: () => import('../views/PostDetail.vue'),
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('../views/Archive.vue'),
  },
  {
    path: '/category/:name',
    name: 'category',
    component: () => import('../views/Category.vue'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/About.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFound.vue'),
  },
]

// 构建时每篇文章都会预渲染成独立的 HTML（scripts/prerender.mjs），
// 所以用 history 模式：地址是 /post/xxx/ 这种真实路径，爬虫能分别收录。
// GitHub Pages 上靠 dist/404.html 兜底未知路径，旧的书签与 hash 链接在 main.js 里重定向。
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 84, behavior: 'smooth' }
    return { top: 0 }
  },
})

const titles = {
  home: `${site.title} · ${site.description}`,
  archive: `归档 · ${site.title}`,
  tags: `分类 · ${site.title}`,
  about: `关于 · ${site.title}`,
  'not-found': `页面不存在 · ${site.title}`,
}

router.afterEach((to) => {
  // 文章页会自己设置更精确的标题、描述和结构化数据
  if (to.name === 'post') return

  setPageMeta({
    title: titles[to.name] || site.title,
    description: site.description,
  })
  setCanonical(to.fullPath)
  setJsonLd(null)
})

export default router
