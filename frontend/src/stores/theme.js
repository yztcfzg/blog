import { defineStore } from 'pinia'

const STORAGE_KEY = 'blog-theme'

function preferred() {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: 'light',
  }),

  getters: {
    isDark: (state) => state.mode === 'dark',
  },

  actions: {
    // 在 app.mount 之前调用，避免首屏闪白
    init() {
      this.mode = preferred()
      this.apply()
    },

    apply() {
      document.documentElement.dataset.theme = this.mode
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', this.mode === 'dark' ? '#121211' : '#fcfcfa')
    },

    toggle() {
      this.mode = this.mode === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, this.mode)
      this.apply()
    },
  },
})
