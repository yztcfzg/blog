<template>
  <div class="wrap">
    <section class="hero">
      <h1 class="hero__name">{{ site.author }}</h1>
      <p class="hero__desc">{{ site.description }}</p>
      <p v-if="metaText" class="hero__meta">{{ metaText }}</p>
    </section>

    <div v-if="pagePosts.length" class="post-list">
      <PostRow v-for="post in pagePosts" :key="post.slug" :post="post" />
    </div>

    <p v-else class="empty">还没有文章。</p>

    <nav v-if="totalPages > 1" class="pager" aria-label="分页">
      <button class="pager__btn" :disabled="page === 1" @click="go(page - 1)">← 上一页</button>
      <span class="pager__info">{{ page }} / {{ totalPages }}</span>
      <button class="pager__btn" :disabled="page === totalPages" @click="go(page + 1)">下一页 →</button>
    </nav>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { site } from '../../site.config'
import { allPosts } from '../lib/posts'
import PostRow from '../components/PostRow.vue'

const page = ref(1)
const pageSize = site.pageSize > 0 ? site.pageSize : 0

const totalPages = computed(() =>
  pageSize ? Math.max(1, Math.ceil(allPosts.length / pageSize)) : 1
)

const pagePosts = computed(() => {
  if (!pageSize) return allPosts
  const start = (page.value - 1) * pageSize
  return allPosts.slice(start, start + pageSize)
})

function go(target) {
  page.value = Math.min(Math.max(1, target), totalPages.value)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const metaText = computed(() => {
  const latest = allPosts[0]
  if (!latest) return ''
  return `${allPosts.length} 篇文章 · 最后更新 ${latest.dateText}`
})
</script>
