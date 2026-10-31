<template>
  <footer class="site-footer">
    <div class="wrap site-footer__inner">
      <span>© {{ year }} {{ site.author }}</span>
    </div>
  </footer>
</template>

<script setup>
import { site } from '../../site.config'

const year = new Date().getFullYear()
</script>
