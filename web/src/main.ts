import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createWebHistory } from 'vue-router';
import App from './App.vue';
import { setApi } from './api';
import { createAppRouter } from './router';
import './styles/main.css';

// Мок только в режиме разработки; в релизной сборке ветка удаляется целиком
if (import.meta.env.DEV) {
  const { createMockAuthApi } = await import('./api/mockAuthApi');
  setApi(createMockAuthApi());
}

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(createAppRouter(createWebHistory()));
app.mount('#app');
