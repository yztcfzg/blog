<template>
  <div class="wrap">
    <section class="hero">
      <h1 class="hero__name">{{ site.author }}</h1>
      <p class="hero__desc">{{ site.description }}</p>

      <p v-if="metaText" class="hero__meta">{{ metaText }}</p>

      <div class="hero__links">
        <a v-if="site.links.github" :href="site.links.github" target="_blank" rel="noopener" class="hero__link">
          GitHub
        </a>
        <a v-if="site.links.rss" :href="rssUrl" class="hero__link">RSS</a>
        <router-link to="/about" class="hero__link">关于我</router-link>
      </div>
    </section>

    <div v-if="allPosts.length" class="post-list">
      <PostRow v-for="post in allPosts" :key="post.slug" :post="post" />
    </div>

    <p v-else class="empty">还没有文章。</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { site } from '../../site.config'
import { allPosts } from '../lib/posts'
import PostRow from '../components/PostRow.vue'

const rssUrl = `${import.meta.env.BASE_URL}rss.xml`

const metaText = computed(() => {
  const latest = allPosts[0]
  if (!latest) return ''
  return `${allPosts.length} 篇文章 · 最后更新 ${latest.dateText}`
})
</script>
