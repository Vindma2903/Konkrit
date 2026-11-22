import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '@/App.vue';
import { setApi, type StaffAuthApi } from '@/api';
import { createMockAuthApi } from '@/api/mockAuthApi';
import { createAppRouter } from '@/router';

export async function mountApp(path: string, api: StaffAuthApi = createMockAuthApi({ latencyMs: 0 })) {
  setApi(api);
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router, pinia, api };
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
