<template>
  <footer class="site-footer">
    <div class="wrap site-footer__inner">
      <span>© {{ year }} {{ site.author }}</span>
      <div class="site-footer__links">
        <router-link to="/archive">归档</router-link>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { site } from '../../site.config'

const year = new Date().getFullYear()
</script>
