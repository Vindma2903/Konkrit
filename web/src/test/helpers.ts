import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '@/App.vue';
import { setApi, type StaffAuthApi } from '@/api';
import { createMockStaff, type MockStaff } from '@/api/mockAuthApi';
import { createAppRouter } from '@/router';
import { useSessionStore } from '@/stores/session';

const mounted: VueWrapper[] = [];

/** Размонтирует всё, что смонтировал mountApp, чтобы узлы не копились в document.body. */
export function unmountAll() {
  for (const wrapper of mounted.splice(0)) {
    try {
      wrapper.unmount();
    } catch {
      // уже размонтирован тестом
    }
  }
  document.body.innerHTML = '';
}

export async function mountApp(
  path: string,
  api?: StaffAuthApi,
  mock: MockStaff = createMockStaff({ latencyMs: 0 }),
) {
  setApi(api ?? mock.auth, mock.admin);
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  mounted.push(wrapper);
  await flushPromises();
  return { wrapper, router, pinia, api: api ?? mock.auth, mock };
}

/** Открывает приложение уже вошедшим сотрудником (сессия восстанавливается по «запомнить меня»). */
export async function openAs(email: string, path = '/', mock: MockStaff = createMockStaff({ latencyMs: 0 })) {
  const first = await mountApp('/login', undefined, mock);
  await useSessionStore(first.pinia).login({ email, password: 'Password1', remember: true });
  first.wrapper.unmount();
  return mountApp(path, undefined, mock);
}

/** Кнопка по точному тексту. */
export function button(wrapper: VueWrapper, text: string) {
  const found = wrapper.findAll('button, a').find((item) => item.text() === text);
  if (!found) throw new Error(`Кнопка «${text}» не найдена`);
  return found;
}

export async function type(wrapper: VueWrapper, label: string, value: string) {
  const input = findInput(wrapper, label);
  await input.setValue(value);
}

export function findInput(wrapper: VueWrapper, label: string) {
  const labelEl = wrapper.findAll('label').find((item) => item.text() === label);
  if (!labelEl) throw new Error(`Поле «${label}» не найдено`);
  return wrapper.find(`[id="${labelEl.attributes('for') ?? ''}"]`);
}

export async function submit(wrapper: VueWrapper) {
  await wrapper.find('form').trigger('submit');
  await flushPromises();
}
