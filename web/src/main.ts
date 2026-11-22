import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createWebHistory } from 'vue-router';
import App from './App.vue';
import { setApi } from './api';
import { createAppRouter } from './router';
import './styles/main.css';
import './styles/crm.css';

// Мок только в режиме разработки; в релизной сборке ветка удаляется целиком
if (import.meta.env.DEV) {
  const { createMockStaff } = await import('./api/mockAuthApi');
  const mock = createMockStaff({ persist: true });
  setApi(mock.auth, mock.admin);
}

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(createAppRouter(createWebHistory()));
app.mount('#app');
