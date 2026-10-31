import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'
import './styles/main.css'

// 旧的 hash 链接（/blog/#/post/xxx）在 index.html 的内联脚本里就换成真实路径了，
// 这里只负责正常启动。
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// 挂载前确定主题，避免首屏颜色跳变
useThemeStore(pinia).init()

app.use(router)
app.mount('#app')
