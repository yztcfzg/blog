<template>
  <div class="wrap wrap--narrow">
    <header class="page-head">
      <h1 class="page-head__title">标签</h1>
      <p class="page-head__desc">
        {{ currentTag ? `「${currentTag}」下的 ${posts.length} 篇文章` : `${allTags.length} 个标签` }}
      </p>
    </header>

    <div class="tag-cloud">
      <router-link
        v-for="tag in allTags"
        :key="tag.name"
        :to="`/tags/${encodeURIComponent(tag.name)}`"
        class="tag-pill"
        :class="{ 'is-active': tag.name === currentTag }"
      >
        <span>{{ tag.name }}</span>
        <span class="tag-pill__count">{{ tag.count }}</span>
      </router-link>
    </div>

    <div v-if="currentTag" class="post-list" style="margin-top: 32px">
      <PostRow v-for="post in posts" :key="post.slug" :post="post" />
      <p v-if="!posts.length" class="empty">这个标签下还没有文章。</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { allTags, postsByTag } from '../lib/posts'
import PostRow from '../components/PostRow.vue'

const route = useRoute()
const currentTag = computed(() => route.params.tag || '')
const posts = computed(() => postsByTag(currentTag.value))
</script>
