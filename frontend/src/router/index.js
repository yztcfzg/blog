import { createRouter, createWebHashHistory } from 'vue-router'
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

// GitHub Pages 是纯静态托管，hash 模式可以避免刷新/直达链接 404。
// 想换成 history 模式，见 README 的「进阶」一节。
const router = createRouter({
  history: createWebHashHistory(),
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
