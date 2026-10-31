<template>
  <header class="site-header">
    <div class="wrap site-header__inner">
      <router-link to="/" class="brand">{{ site.title }}</router-link>

      <nav class="nav">
        <router-link
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          class="nav__link"
          :class="{ 'is-active': isActive(item) }"
        >
          {{ item.label }}
        </router-link>
        <ThemeToggle />
      </nav>
    </div>
  </header>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { site } from '../../site.config'
import { categories } from '../lib/posts'
import ThemeToggle from './ThemeToggle.vue'

const route = useRoute()

const items = [
  { to: '/', label: '首页', exact: true },
  ...categories.map((name) => ({
    to: `/category/${encodeURIComponent(name)}`,
    label: name,
    category: name,
  })),
  { to: '/about', label: '关于' },
]

function isActive(item) {
  if (item.exact) return route.path === '/'
  if (item.category) return route.params.name === item.category
  return route.path.startsWith(item.to)
}
</script>
