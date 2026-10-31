<template>
  <div class="wrap wrap--narrow">
    <header class="page-head">
      <h1 class="page-head__title">{{ name }}</h1>
      <p v-if="posts.length" class="page-head__desc">{{ posts.length }} 篇文章</p>
    </header>

    <div v-if="posts.length" class="post-list">
      <PostRow v-for="post in posts" :key="post.slug" :post="post" :show-category="false" />
    </div>

    <p v-else class="empty">这个分类下还没有文章。</p>
  </div>
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { site } from '../../site.config'
import { postsByCategory } from '../lib/posts'
import PostRow from '../components/PostRow.vue'

const route = useRoute()
const name = computed(() => route.params.name || '')
const posts = computed(() => postsByCategory(name.value))

watchEffect(() => {
  if (name.value) document.title = `${name.value} · ${site.title}`
})
</script>
