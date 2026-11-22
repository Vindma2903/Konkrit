<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ApiError,
  getAdminApi,
  ROLES,
  roleTitle,
  type House,
  type MemberStatus,
  type Scope,
  type StaffMember,
  type StaffRole,
} from '@/api';
import Icon from '@/features/auth/Icon.vue';
import { commonMessage } from '@/features/auth/form';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { adminCall } from './adminCall';
import ActionMenu, { type MenuAction } from './ActionMenu.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import ReviewPanel from './ReviewPanel.vue';
import StaffHeader from './StaffHeader.vue';

const SEARCH_DELAY_MS = 300;

const STATUS_TITLES: Record<MemberStatus, string> = {
  active: 'Активен',
  vacation: 'В отпуске',
  disabled: 'Отключён',
};
const STATUS_PILLS: Record<MemberStatus, string> = {
  active: 'pill--ok',
  vacation: 'pill--rest',
  disabled: 'pill--off',
};

const session = useSessionStore();
const toast = useToastStore();

const members = ref<StaffMember[]>([]);
const houses = ref<House[]>([]);
const loading = ref(true);
const loadError = ref(false);

const queryText = ref('');
const query = ref('');
const role = ref<StaffRole | ''>('');
const houseId = ref('');
const status = ref<MemberStatus | ''>('');
const filtersActive = computed(() => Boolean(query.value.trim() || role.value || houseId.value || status.value));

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(queryText, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    query.value = value;
  }, SEARCH_DELAY_MS);
});
onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  controller?.abort();
});

let version = 0;
let controller: AbortController | undefined;

async function load(silent = false) {
  const mine = (version += 1);
  // Запрос прежнего текста отменяется и не перезапишет новый
  controller?.abort();
  controller = new AbortController();
  if (!silent) loading.value = true;
  try {
    const list = await adminCall(() =>
      getAdminApi().listMembers({
        query: query.value.trim() || undefined,
        role: role.value || undefined,
        houseId: houseId.value || undefined,
        status: status.value || undefined,
        signal: controller?.signal,
      }),
    );
    if (mine !== version) return;
    members.value = list;
    loadError.value = false;
  } catch {
    // Тихое обновление после действия не подменяет таблицу экраном ошибки
    if (mine === version && !silent) loadError.value = true;
  } finally {
    if (mine === version) loading.value = false;
  }
}

onMounted(async () => {
  void load();
  try {
    houses.value = await adminCall(() => getAdminApi().listHouses());
  } catch {
    // фильтр по домам останется пустым, список работает и без него
  }
});
watch([query, role, houseId, status], () => void load());

function resetFilters() {
  queryText.value = '';
  query.value = '';
  role.value = '';
  houseId.value = '';
  status.value = '';
}

const houseTitles = computed(() => new Map(houses.value.map((house) => [house.id, house.title])));
const scopeText = (scope: Scope) =>
  scope.all ? 'Все дома' : scope.houseIds.map((id) => houseTitles.value.get(id) ?? id).join(', ');

const selfId = computed(() => session.session?.user.id);

function actionsFor(member: StaffMember): MenuAction[] {
  const list: MenuAction[] = [{ key: 'edit', label: 'Изменить роль и дома' }];
  if (member.status === 'active') list.push({ key: 'vacation', label: 'В отпуске' });
  if (member.status === 'vacation') list.push({ key: 'return', label: 'Вернуть из отпуска' });
  if (member.status === 'disabled') list.push({ key: 'enable', label: 'Включить доступ' });
  else if (member.id !== selfId.value) list.push({ key: 'disable', label: 'Отключить доступ', danger: true });
  return list;
}

const editing = ref<StaffMember | null>(null);
const disabling = ref<StaffMember | null>(null);
const busy = ref(false);
const actionError = ref('');

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'last_manager') return 'Нельзя отключить последнего руководителя';
    if (error.code === 'not_found') return 'Сотрудник не найден. Обновите список';
    if (error.code === 'validation' && error.fields) return Object.values(error.fields)[0] ?? commonMessage(error);
  }
  return commonMessage(error);
}

async function patch(member: StaffMember, change: Parameters<ReturnType<typeof getAdminApi>['updateMember']>[1], done: string) {
  if (busy.value) return false;
  busy.value = true;
  actionError.value = '';
  try {
    await adminCall(() => getAdminApi().updateMember(member.id, change));
    toast.show(done);
    await load(true);
    return true;
  } catch (error) {
    actionError.value = errorText(error);
    return false;
  } finally {
    busy.value = false;
  }
}

async function onSelect(member: StaffMember, key: string) {
  actionError.value = '';
  if (key === 'edit') editing.value = member;
  else if (key === 'disable') disabling.value = member;
  else if (key === 'vacation') await patch(member, { status: 'vacation' }, `${member.name}: в отпуске`);
  else if (key === 'return') await patch(member, { status: 'active' }, `${member.name}: вернулся из отпуска`);
  else if (key === 'enable') await patch(member, { status: 'active' }, `Доступ включён: ${member.name}`);
}

async function saveEdit(value: { role: StaffRole; scope: Scope }) {
  const member = editing.value;
  if (!member) return;
  const ok = await patch(member, { role: value.role, scope: value.scope }, 'Изменения сохранены');
  if (ok) editing.value = null;
}

async function confirmDisable() {
  const member = disabling.value;
  if (!member) return;
  const ok = await patch(member, { status: 'disabled' }, `Доступ отключён: ${member.name}`);
  if (ok) disabling.value = null;
}
</script>

<template>
  <section class="page">
    <StaffHeader />

    <div class="toolbar">
      <div class="search">
        <span class="search__icon" aria-hidden="true"><Icon name="search" /></span>
        <input
          v-model="queryText"
          class="field__input"
          type="search"
          autocomplete="off"
          aria-label="Поиск по сотрудникам"
          placeholder="Поиск по сотрудникам"
        />
      </div>
      <select v-model="role" class="select" aria-label="Роль">
        <option value="">Роль: все</option>
        <option v-for="item in ROLES" :key="item.key" :value="item.key">{{ item.title }}</option>
      </select>
      <select v-model="houseId" class="select" aria-label="Дом / участок">
        <option value="">Дом / участок: все</option>
        <option v-for="house in houses" :key="house.id" :value="house.id">{{ house.title }}</option>
      </select>
      <select v-model="status" class="select" aria-label="Статус">
        <option value="">Статус: все</option>
        <option value="active">Активен</option>
        <option value="vacation">В отпуске</option>
        <option value="disabled">Отключён</option>
      </select>
    </div>

    <p v-if="actionError && !editing && !disabling" class="alert" role="alert">{{ actionError }}</p>

    <div class="table-card">
      <p v-if="loading" class="table-state" data-testid="staff-loading">Загружаем сотрудников…</p>
      <div v-else-if="loadError" class="table-state">
        <span class="field__error">Не удалось загрузить сотрудников</span>
        <button class="btn btn--outline" type="button" @click="load()">Повторить</button>
      </div>
      <div v-else-if="members.length === 0" class="table-empty" data-testid="staff-empty">
        <span>{{ filtersActive ? 'Сотрудники не найдены' : 'Сотрудников пока нет' }}</span>
        <button v-if="filtersActive" class="btn btn--outline" type="button" @click="resetFilters">
          Сбросить фильтры
        </button>
      </div>
      <table v-else class="table">
        <thead>
          <tr>
            <th scope="col">Сотрудник</th>
            <th scope="col">Роль</th>
            <th scope="col">Дом / участок</th>
            <th scope="col">Статус</th>
            <th scope="col"><span class="sr-only">Действия</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in members" :key="member.id" :data-testid="`member-${member.id}`">
            <td>
              <div class="person">
                <span class="avatar" aria-hidden="true"><Icon name="user" /></span>
                <span class="person__text">
                  <span class="person__name">{{ member.name }}</span>
                  <span class="person__sub">{{ member.phone }}</span>
                </span>
              </div>
            </td>
            <td>{{ roleTitle(member.role) }}</td>
            <td>{{ scopeText(member.scope) }}</td>
            <td>
              <span class="pill" :class="STATUS_PILLS[member.status]">{{ STATUS_TITLES[member.status] }}</span>
            </td>
            <td>
              <ActionMenu
                :label="`Действия с сотрудником ${member.name}`"
                :actions="actionsFor(member)"
                @select="onSelect(member, $event)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ReviewPanel
      v-if="editing"
      mode="edit"
      :person="{ name: editing.name, email: editing.email, phone: editing.phone }"
      :initial-role="editing.role"
      :initial-scope="editing.scope"
      :busy="busy"
      :error="actionError"
      @close="editing = null"
      @submit="saveEdit"
    />
    <ConfirmDialog
      v-if="disabling"
      :title="`Отключить доступ для ${disabling.name}?`"
      text="Сотрудник не сможет войти"
      confirm-label="Отключить доступ"
      danger
      :busy="busy"
      :error="actionError"
      @confirm="confirmDisable"
      @cancel="disabling = null"
    />
  </section>
</template>
