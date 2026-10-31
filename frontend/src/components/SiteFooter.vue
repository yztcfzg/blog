<template>
  <footer class="site-footer">
    <div class="wrap site-footer__inner">
      <span>© {{ year }} {{ site.author }}</span>
      <div class="site-footer__links">
        <a v-if="site.links.github" :href="site.links.github" target="_blank" rel="noopener">
          GitHub
        </a>
        <a v-if="site.links.email" :href="`mailto:${site.links.email}`">Email</a>
        <a v-if="site.links.rss" :href="rssUrl">RSS</a>
        <router-link to="/about">关于</router-link>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { site } from '../../site.config'

const year = new Date().getFullYear()
const rssUrl = `${import.meta.env.BASE_URL}rss.xml`
</script>
