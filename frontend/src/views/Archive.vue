<template>
  <div class="wrap wrap--narrow">
    <header class="page-head">
      <h1 class="page-head__title">归档</h1>
      <p class="page-head__desc">共 {{ allPosts.length }} 篇文章，按时间倒序。</p>
    </header>

    <section v-for="[year, posts] in postsByYear" :key="year" class="year-group">
      <div class="year-group__label">{{ year }}</div>

      <router-link
        v-for="post in posts"
        :key="post.slug"
        :to="`/post/${post.slug}`"
        class="archive-row"
      >
        <span class="archive-row__date">{{ post.dateText.slice(5) }}</span>
        <span class="archive-row__title">{{ post.title }}</span>
      </router-link>
    </section>

    <p v-if="!allPosts.length" class="empty">还没有文章。</p>
  </div>
</template>

<script setup>
import { allPosts, postsByYear } from '../lib/posts'
</script>
