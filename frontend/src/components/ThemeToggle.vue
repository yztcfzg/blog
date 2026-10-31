<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
    :title="isDark ? '浅色' : '深色'"
    @click="theme.toggle()"
  >
    <svg
      v-if="isDark"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
    <svg
      v-else
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5a8.6 8.6 0 1 0 10.9 10.9Z" />
    </svg>
  </button>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useThemeStore } from '../stores/theme'

const theme = useThemeStore()
const { isDark } = storeToRefs(theme)
</script>
