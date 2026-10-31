<template>
  <div class="wrap">
    <section class="hero">
      <h1 class="hero__name">{{ site.author }}</h1>
      <p class="hero__desc">{{ site.description }}</p>
      <p v-if="metaText" class="hero__meta">{{ metaText }}</p>
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

const metaText = computed(() => {
  const latest = allPosts[0]
  if (!latest) return ''
  return `${allPosts.length} 篇文章 · 最后更新 ${latest.dateText}`
})
</script>
