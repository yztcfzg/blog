<template>
  <div class="wrap wrap--narrow">
    <template v-if="post">
      <div v-if="progress > 0" class="reading-bar" :style="{ transform: `scaleX(${progress})` }" />

      <router-link to="/" class="back-link">← 返回列表</router-link>

      <article class="article">
        <header>
          <h1 class="article__title">{{ post.title }}</h1>

          <div class="article__meta">
            <time :datetime="isoDate">{{ post.dateText }}</time>
            <span class="article__meta-dot" />
            <span>{{ post.readingTime }} 分钟阅读</span>
            <template v-if="post.tags.length">
              <span class="article__meta-dot" />
              <span class="article__tags">
                <router-link
                  v-for="tag in post.tags"
                  :key="tag"
                  :to="`/tags/${encodeURIComponent(tag)}`"
                  class="tag"
                >
                  {{ tag }}
                </router-link>
              </span>
            </template>
          </div>
        </header>

        <nav v-if="toc.length >= 3" class="toc" aria-label="目录">
          <div class="toc__label">目录</div>
          <ul class="toc__list">
            <li
              v-for="item in toc"
              :key="item.id"
              class="toc__item"
              :class="{ 'toc__item--3': item.level === 3 }"
            >
              <a :href="`#${item.id}`" @click.prevent="scrollTo(item.id)">{{ item.text }}</a>
            </li>
          </ul>
        </nav>

        <div ref="contentRef" class="prose" v-html="html" />

        <nav v-if="prev || next" class="article-nav">
          <router-link
            v-if="prev"
            :to="`/post/${prev.slug}`"
            class="article-nav__item"
          >
            <span class="article-nav__label">← 上一篇</span>
            <span class="article-nav__title">{{ prev.title }}</span>
          </router-link>
          <span v-else />

          <router-link
            v-if="next"
            :to="`/post/${next.slug}`"
            class="article-nav__item article-nav__item--next"
          >
            <span class="article-nav__label">下一篇 →</span>
            <span class="article-nav__title">{{ next.title }}</span>
          </router-link>
        </nav>
      </article>
    </template>

    <NotFound v-else />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { site } from '../../site.config'
import { findPost, neighbors } from '../lib/posts'
import { renderMarkdown, enhanceContent, extractToc } from '../lib/markdown'
import NotFound from './NotFound.vue'

const route = useRoute()
const contentRef = ref(null)
const progress = ref(0)

const post = computed(() => findPost(route.params.slug))
const html = computed(() => (post.value ? renderMarkdown(post.value.body) : ''))
const toc = computed(() => (post.value ? extractToc(html.value) : []))
const nearby = computed(() =>
  post.value ? neighbors(post.value.slug) : { prev: null, next: null }
)
const prev = computed(() => nearby.value.prev)
const next = computed(() => nearby.value.next)

const isoDate = computed(() => (post.value ? post.value.date.toISOString().slice(0, 10) : ''))

async function hydrate() {
  if (!post.value) {
    document.title = `页面不存在 · ${site.title}`
    return
  }
  document.title = `${post.value.title} · ${site.title}`
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', post.value.summary || site.description)

  await nextTick()
  await enhanceContent(contentRef.value)
  window.scrollTo({ top: 0 })
}

function onScroll() {
  const el = contentRef.value
  if (!el) return
  const scrolled = -el.getBoundingClientRect().top
  const total = el.offsetHeight - window.innerHeight * 0.6
  progress.value = Math.min(1, Math.max(0, scrolled / Math.max(total, 1)))
}

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  hydrate()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})

watch(() => route.params.slug, hydrate)
</script>
