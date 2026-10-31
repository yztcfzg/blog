<template>
  <article class="post-row">
    <time class="post-row__date" :datetime="isoDate">{{ post.dateText }}</time>

    <div>
      <router-link :to="`/post/${post.slug}`" class="post-row__link">
        <h2 class="post-row__title">{{ post.title }}</h2>
      </router-link>

      <p v-if="post.summary" class="post-row__summary">{{ post.summary }}</p>

      <p v-if="post.category" class="post-row__category">
        <router-link
          :to="`/category/${encodeURIComponent(post.category)}`"
          class="category"
        >
          {{ post.category }}
        </router-link>
      </p>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  post: { type: Object, required: true },
})

const isoDate = computed(() => props.post.date.toISOString().slice(0, 10))
</script>
