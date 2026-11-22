<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import {
  ApiError,
  getAdminApi,
  PERMISSIONS,
  ROLES,
  type Permission,
  type RolesMatrix,
  type StaffRole,
} from '@/api';
import { NETWORK_MESSAGE } from '@/features/auth/form';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import Icon from '@/features/auth/Icon.vue';
import { adminCall } from './adminCall';
import ConfirmDialog from './ConfirmDialog.vue';

const session = useSessionStore();
const toast = useToastStore();

const saved = ref<RolesMatrix | null>(null);
const draft = ref<RolesMatrix | null>(null);
const loading = ref(true);
const loadError = ref(false);
const saving = ref(false);
const saveError = ref('');

const clone = (value: RolesMatrix): RolesMatrix => JSON.parse(JSON.stringify(value)) as RolesMatrix;
const normalized = (value: RolesMatrix | null) =>
  JSON.stringify(ROLES.map((role) => [...(value?.[role.key] ?? [])].sort()));
const dirty = computed(() => normalized(saved.value) !== normalized(draft.value));

async function load() {
  loading.value = true;
  loadError.value = false;
  try {
    const matrix = await adminCall(() => getAdminApi().getRoles());
    saved.value = matrix;
    draft.value = clone(matrix);
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const has = (role: StaffRole, permission: Permission) => draft.value?.[role].includes(permission) ?? false;
// Без этого права руководитель потерял бы возможность управлять доступом
const locked = (role: StaffRole, permission: Permission) => role === 'manager' && permission === 'staff.manage';

function toggle(role: StaffRole, permission: Permission, checked: boolean) {
  if (!draft.value || locked(role, permission)) return;
  const current = draft.value[role];
  draft.value[role] = checked
    ? current.includes(permission)
      ? current
      : [...current, permission]
    : current.filter((item) => item !== permission);
  saveError.value = '';
}

function cancel() {
  if (saved.value) draft.value = clone(saved.value);
  saveError.value = '';
}

async function save() {
  if (!draft.value || !dirty.value || saving.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    // Сохраняем снимок: правка, сделанная во время запроса, не должна считаться сохранённой
    const snapshot = clone(draft.value);
    await adminCall(() => getAdminApi().saveRoles(snapshot));
    saved.value = snapshot;
    toast.show('Права сохранены');
    // Свои права могли измениться: меню и доступ обновляются сразу
    void session.reload();
  } catch (error) {
    saveError.value =
      error instanceof ApiError && error.code === 'network'
        ? NETWORK_MESSAGE
        : 'Не удалось сохранить права. Повторите';
  } finally {
    saving.value = false;
  }
}

// Уход с несохранёнными изменениями: диалог внутри приложения и стандартное предупреждение браузера
const leaving = ref<((answer: boolean) => void) | null>(null);

onBeforeRouteLeave(() => {
  if (!dirty.value) return true;
  return new Promise<boolean>((resolve) => {
    leaving.value = resolve;
  });
});

function answerLeave(answer: boolean) {
  leaving.value?.(answer);
  leaving.value = null;
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return;
  event.preventDefault();
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload));
</script>

<template>
  <section class="page">
    <RouterLink class="link" :to="{ name: 'staff' }">
      <Icon name="arrowLeft" :size="18" />
      Сотрудники
    </RouterLink>
    <div class="page__head">
      <h1 class="page__title">Роли и права</h1>
      <div class="page__actions">
        <button class="btn btn--outline" type="button" :disabled="!dirty || saving" @click="cancel">Отмена</button>
        <button class="btn btn--inline" type="button" :disabled="!dirty || saving" @click="save">Сохранить</button>
      </div>
    </div>
    <p class="hint-line">
      Отметьте функции, доступные каждой роли. Изменения применяются ко всем сотрудникам с этой ролью.
    </p>
    <p v-if="saveError" class="alert" role="alert">{{ saveError }}</p>

    <div class="table-card">
      <p v-if="loading" class="table-state" data-testid="roles-loading">Загружаем права…</p>
      <div v-else-if="loadError" class="table-state">
        <span class="field__error">Не удалось загрузить права</span>
        <button class="btn btn--outline" type="button" @click="load">Повторить</button>
      </div>
      <table v-else class="table matrix">
        <thead>
          <tr>
            <th scope="col">Функция</th>
            <th v-for="role in ROLES" :key="role.key" scope="col">{{ role.title }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="permission in PERMISSIONS" :key="permission.key">
            <td>{{ permission.title }}</td>
            <td v-for="role in ROLES" :key="role.key">
              <label class="cell-box">
                <input
                  type="checkbox"
                  :checked="has(role.key, permission.key)"
                  :disabled="saving || locked(role.key, permission.key)"
                  :aria-label="`${permission.title}: ${role.title}`"
                  :aria-describedby="locked(role.key, permission.key) ? 'locked-hint' : undefined"
                  @change="toggle(role.key, permission.key, ($event.target as HTMLInputElement).checked)"
                />
              </label>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p id="locked-hint" class="hint-line">Нужен, чтобы управлять доступом: у руководителя право «Управлять сотрудниками» не снимается.</p>

    <ConfirmDialog
      v-if="leaving"
      title="Выйти без сохранения?"
      text="Изменения прав не сохранены."
      confirm-label="Выйти"
      cancel-label="Остаться"
      danger
      @confirm="answerLeave(true)"
      @cancel="answerLeave(false)"
    />
  </section>
</template>
