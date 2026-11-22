<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  ApiError,
  getAdminApi,
  type AccessRequest,
  type ApproveInput,
} from '@/api';
import Icon from '@/features/auth/Icon.vue';
import { commonMessage } from '@/features/auth/form';
import { useAccessStore } from '@/stores/access';
import { useToastStore } from '@/stores/toast';
import { adminCall } from './adminCall';
import ConfirmDialog from './ConfirmDialog.vue';
import { formatDate } from './format';
import ReviewPanel from './ReviewPanel.vue';
import StaffHeader from './StaffHeader.vue';

const POLL_MS = 30_000;

const route = useRoute();
const access = useAccessStore();
const toast = useToastStore();

const status = computed(() => (route.query.status === 'rejected' ? 'rejected' : 'pending'));
const items = ref<AccessRequest[]>([]);
const loading = ref(true);
const loadError = ref(false);

let version = 0;

/** Загрузка списка; тихая — без «Загружаем…» (опрос и обновление после действий). */
async function load(silent = false) {
  const mine = (version += 1);
  if (!silent) loading.value = true;
  try {
    const page = await adminCall(() => getAdminApi().listAccessRequests(status.value));
    // Ответ на прежнюю вкладку не должен затирать текущую
    if (mine !== version) return;
    items.value = page.items;
    access.pendingCount = page.pendingCount;
    loadError.value = false;
  } catch {
    if (mine === version && !silent) loadError.value = true;
  } finally {
    if (mine === version) loading.value = false;
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
const onVisible = () => {
  if (document.visibilityState === 'visible') void load(true);
};
onMounted(() => {
  void load();
  timer = setInterval(() => void load(true), POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisible);
});
watch(status, () => void load());

// Что открыто: панель подтверждения или диалог отклонения для заявки
const reviewing = ref<AccessRequest | null>(null);
const rejecting = ref<AccessRequest | null>(null);
const busy = ref(false);
const actionError = ref('');

// Кнопка, с которой открыли окно: на неё вернётся фокус (по клику на строку — кнопка этой строки)
const opener = ref<HTMLElement | null>(null);

function triggerOf(event?: Event): HTMLElement | null {
  const target = event?.currentTarget;
  if (!(target instanceof HTMLElement)) return null;
  return target.tagName === 'BUTTON' ? target : target.querySelector('button');
}

function open(request: AccessRequest, event?: Event) {
  actionError.value = '';
  opener.value = triggerOf(event);
  reviewing.value = request;
}

function askReject(request: AccessRequest, event?: Event) {
  actionError.value = '';
  // из панели диалог открывают поверх неё: без события фокус вернётся на активный элемент панели
  opener.value = triggerOf(event);
  rejecting.value = request;
}

function cancelReject() {
  rejecting.value = null;
  actionError.value = '';
}

function closeAll() {
  reviewing.value = null;
  rejecting.value = null;
  actionError.value = '';
}

/** Общая реакция на ошибки действий: заявку уже обработали — закрываем и обновляем список. */
function handleError(error: unknown) {
  if (error instanceof ApiError && error.code === 'already_processed') {
    closeAll();
    toast.show('Заявка уже обработана');
    void load(true);
    return;
  }
  if (error instanceof ApiError && error.code === 'validation' && error.fields?.scope) {
    actionError.value = error.fields.scope;
    return;
  }
  actionError.value = commonMessage(error);
}

async function approve(input: ApproveInput) {
  const request = reviewing.value;
  if (!request || busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    await adminCall(() => getAdminApi().approveAccessRequest(request.id, input));
    closeAll();
    toast.show(`Доступ открыт: ${request.name}`);
    await load(true);
  } catch (error) {
    handleError(error);
  } finally {
    busy.value = false;
  }
}

async function reject() {
  const request = rejecting.value ?? reviewing.value;
  if (!request || busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    await adminCall(() => getAdminApi().rejectAccessRequest(request.id));
    closeAll();
    toast.show('Заявка отклонена');
    await load(true);
  } catch (error) {
    handleError(error);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="page">
    <StaffHeader />
    <p v-if="status === 'pending'" class="banner">
      Эти сотрудники зарегистрировались и ждут подтверждения. Пока доступ не открыт, войти в кабинет они не могут.
    </p>

    <div class="table-card">
      <p v-if="loading" class="table-state" data-testid="access-loading">Загружаем заявки…</p>
      <div v-else-if="loadError" class="table-state">
        <span class="field__error">Не удалось загрузить заявки</span>
        <button class="btn btn--outline" type="button" @click="load()">Повторить</button>
      </div>
      <p v-else-if="items.length === 0" class="table-empty" data-testid="access-empty">
        {{ status === 'pending' ? 'Новых заявок нет' : 'Отклонённых заявок нет' }}
      </p>
      <table v-else class="table">
        <thead>
          <tr>
            <th scope="col">Сотрудник</th>
            <th scope="col">Телефон</th>
            <th scope="col">Заявка от</th>
            <th scope="col">Статус</th>
            <th scope="col">Действие</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in items" :key="request.id" class="row--click" :data-testid="`request-${request.id}`" @click="open(request, $event)">
            <td>
              <div class="person">
                <span class="avatar" aria-hidden="true"><Icon name="user" /></span>
                <span class="person__text">
                  <span class="person__name">{{ request.name }}</span>
                  <span class="person__sub">{{ request.email }}</span>
                </span>
              </div>
            </td>
            <td>{{ request.phone }}</td>
            <td>{{ formatDate(request.createdAt) }}</td>
            <td>
              <span class="pill" :class="request.status === 'pending' ? 'pill--wait' : 'pill--off'">
                {{ request.status === 'pending' ? 'Ожидает' : 'Отклонена' }}
              </span>
            </td>
            <td>
              <div class="row-actions">
                <button
                  class="btn btn--sm"
                  type="button"
                  :aria-label="`Подтвердить: ${request.name}`"
                  @click.stop="open(request, $event)"
                >
                  Подтвердить
                </button>
                <button
                  v-if="request.status === 'pending'"
                  class="btn btn--sm btn--outline"
                  type="button"
                  :aria-label="`Отклонить: ${request.name}`"
                  @click.stop="askReject(request, $event)"
                >
                  Отклонить
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ReviewPanel
      v-if="reviewing"
      mode="approve"
      :person="{ name: reviewing.name, email: reviewing.email, phone: reviewing.phone, company: reviewing.company }"
      :requested-at="reviewing.createdAt"
      :rejected="reviewing.status === 'rejected'"
      :busy="busy"
      :error="rejecting ? '' : actionError"
      :opener="opener"
      @close="closeAll"
      @submit="approve"
      @reject="askReject(reviewing, $event)"
    />
    <ConfirmDialog
      v-if="rejecting"
      :title="`Отклонить заявку от ${rejecting.name}?`"
      text="Сотрудник не сможет войти"
      confirm-label="Отклонить"
      danger
      :busy="busy"
      :error="actionError"
      :opener="opener"
      @confirm="reject"
      @cancel="cancelReject"
    />
  </section>
</template>
