import { createRouter, type RouterHistory } from 'vue-router';
import { useFlowStore } from '@/stores/flow';
import { useSessionStore } from '@/stores/session';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
  }
}

const RESTORE_WAIT_MS = 3000;

export function createAppRouter(history: RouterHistory) {
  const router = createRouter({
    history,
    routes: [
      {
        path: '/',
        name: 'cabinet',
        component: () => import('@/features/cabinet/CabinetView.vue'),
        meta: { requiresAuth: true },
      },
      { path: '/login', name: 'login', component: () => import('@/features/auth/LoginView.vue'), meta: { guestOnly: true } },
      { path: '/register', name: 'register', component: () => import('@/features/auth/RegisterView.vue'), meta: { guestOnly: true } },
      { path: '/pending', name: 'pending', component: () => import('@/features/auth/PendingView.vue'), meta: { guestOnly: true } },
      { path: '/forgot', name: 'forgot', component: () => import('@/features/auth/ForgotView.vue'), meta: { guestOnly: true } },
      {
        path: '/forgot/sent',
        name: 'forgot-sent',
        component: () => import('@/features/auth/SentView.vue'),
        meta: { guestOnly: true },
        // Без отправленного запроса письма нет — возвращаем к форме
        beforeEnter: () => (useFlowStore().recovery ? true : { name: 'forgot' }),
      },
      { path: '/reset', name: 'reset', component: () => import('@/features/auth/ResetView.vue'), meta: { guestOnly: true } },
      { path: '/:pathMatch(.*)*', redirect: '/' },
    ],
  });

  router.beforeEach(async (to) => {
    const session = useSessionStore();
    // Не держим экран дольше 3 с, если бэкенд не отвечает: восстановление продолжится в фоне
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      session.restore(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, RESTORE_WAIT_MS);
      }),
    ]);
    clearTimeout(timer);
    if (to.meta.requiresAuth && !session.session) {
      return { name: 'login', query: { next: to.fullPath } };
    }
    if (to.meta.guestOnly && session.session) return { name: 'cabinet' };
    return true;
  });

  return router;
}
