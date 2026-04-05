import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'practice',
      component: () => import('./components/PracticeView.vue'),
    },
    {
      path: '/words',
      name: 'words',
      component: () => import('./components/WordList.vue'),
    },
  ],
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
