<template>
  <div class="wrap wrap--narrow">
    <article class="article">
      <div ref="contentRef" class="prose prose--about" v-html="html" />
    </article>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import aboutRaw from '../../content/about.md?raw'
import { renderMarkdown, enhanceContent } from '../lib/markdown'

const contentRef = ref(null)
const html = renderMarkdown(aboutRaw.replace(/^---[\s\S]*?---\s*/, ''))

onMounted(async () => {
  await enhanceContent(contentRef.value)
})
</script>

<style scoped>
.prose--about {
  margin-top: 8px;
}
</style>
