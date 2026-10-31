import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,jsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/node_modules/**']),

  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // 构建配置和 Node 脚本运行在 Node 环境，需要 process / Buffer 等全局变量
  {
    name: 'app/node-scripts',
    files: ['vite.config.js', 'eslint.config.js', 'scripts/**/*.mjs', 'site.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  skipFormatting,

  {
    rules: {
      // 页面组件用 Home / About 这类单词命名，语义比 HomeView 更清晰
      'vue/multi-word-component-names': 'off',
    },
  },
])
