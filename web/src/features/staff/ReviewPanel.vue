<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId } from 'vue';
import {
  getAdminApi,
  permissionTitle,
  ROLES,
  type House,
  type RolesMatrix,
  type Scope,
  type StaffRole,
} from '@/api';
import Icon from '@/features/auth/Icon.vue';
import { commonMessage } from '@/features/auth/form';
import { adminCall } from './adminCall';
import { formatDate } from './format';
import { useFocusTrap } from './focus';

export type Person = { name: string; email: string; phone: string; company?: string };

const props = defineProps<{
  /** approve — подтверждение заявки; edit — изменение роли и домов сотрудника. */
  mode: 'approve' | 'edit';
  person: Person;
  /** Дата заявки (только для подтверждения). */
  requestedAt?: string;
  initialRole?: StaffRole;
  initialScope?: Scope;
  /** Отклонённая заявка: «Отклонить» скрыта. */
  rejected?: boolean;
  busy?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [value: { role: StaffRole; scope: Scope; notify: boolean }];
  reject: [];
}>();

const titleId = useId();
const roleId = useId();
const root = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);
useFocusTrap(root, () => emit('close'), '[data-close]');

const role = ref<StaffRole>(props.initialRole ?? 'engineer');
const all = ref(props.initialScope?.all ?? false);
const houseIds = ref<string[]>([...(props.initialScope?.houseIds ?? [])]);
const notify = ref(true);
const scopeError = ref('');

const houses = ref<House[]>([]);
const matrix = ref<RolesMatrix | null>(null);
const loading = ref(true);
const loadError = ref('');

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const [h, m] = await Promise.all([
      adminCall(() => getAdminApi().listHouses()),
      adminCall(() => getAdminApi().getRoles()),
    ]);
    houses.value = h;
    matrix.value = m;
  } catch (e) {
    loadError.value = commonMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const permissions = computed(() => (matrix.value ? matrix.value[role.value] : []));

// При «Все дома» отдельные дома отмечены и недоступны; при снятии прежний выбор возвращается
function isChecked(id: string) {
  return all.value || houseIds.value.includes(id);
}

function toggleHouse(id: string, checked: boolean) {
  houseIds.value = checked ? [...houseIds.value, id] : houseIds.value.filter((item) => item !== id);
  scopeError.value = '';
}

function toggleAll(checked: boolean) {
  all.value = checked;
  scopeError.value = '';
}

async function submit() {
  if (props.busy) return;
  if (!all.value && houseIds.value.length === 0) {
    scopeError.value = 'Выберите хотя бы один дом или участок';
    await nextTick();
    list.value?.querySelector<HTMLElement>('input')?.focus();
    return;
  }
  emit('submit', {
    role: role.value,
    scope: { all: all.value, houseIds: all.value ? [] : [...houseIds.value] },
    notify: props.mode === 'approve' ? notify.value : false,
  });
}
</script>

<template>
  <div class="overlay">
    <button class="overlay__shade" type="button" tabindex="-1" aria-label="Закрыть" @click="emit('close')" />
    <div ref="root" class="panel" role="dialog" aria-modal="true" :aria-labelledby="titleId">
      <div class="panel__head">
        <div class="group">
          <h2 :id="titleId" class="panel__title">
            {{ mode === 'approve' ? 'Подтверждение доступа' : 'Роль и дома сотрудника' }}
          </h2>
          <span v-if="mode === 'approve' && requestedAt" class="panel__sub">
            Заявка на доступ от {{ formatDate(requestedAt) }}
          </span>
        </div>
        <button class="close-btn" type="button" data-close aria-label="Закрыть" @click="emit('close')">
          <Icon name="close" />
        </button>
      </div>

      <div class="panel__body">
        <div class="person-card">
          <span class="avatar avatar--lg" aria-hidden="true"><Icon name="user" :size="24" /></span>
          <div class="group">
            <span class="person-card__name">{{ person.name }}</span>
            <span class="person-card__sub">{{ person.email }} · {{ person.phone }}</span>
            <span v-if="person.company" class="person-card__sub">{{ person.company }}</span>
          </div>
        </div>

        <p v-if="loading" class="subtitle" data-testid="panel-loading">Загружаем данные…</p>
        <div v-else-if="loadError" class="group">
          <p class="alert" role="alert">Не удалось загрузить данные. {{ loadError }}</p>
          <button class="btn btn--outline" type="button" @click="load">Повторить</button>
        </div>
        <template v-else>
          <div class="group">
            <label class="group__label" :for="roleId">Роль</label>
            <select :id="roleId" v-model="role" class="select select--field">
              <option v-for="item in ROLES" :key="item.key" :value="item.key">{{ item.title }}</option>
            </select>
          </div>

          <div class="group" role="group" aria-label="Дома и участки">
            <span class="group__label">Дома и участки</span>
            <div ref="list" class="checklist">
              <label :class="{ 'is-on': all }">
                <input type="checkbox" :checked="all" @change="toggleAll(($event.target as HTMLInputElement).checked)" />
                <span>Все дома и участки</span>
              </label>
              <label v-for="house in houses" :key="house.id" :class="{ 'is-on': isChecked(house.id) }">
                <input
                  type="checkbox"
                  :checked="isChecked(house.id)"
                  :disabled="all"
                  @change="toggleHouse(house.id, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ house.title }}</span>
              </label>
            </div>
            <p v-if="scopeError" class="field__error" role="alert">{{ scopeError }}</p>
          </div>

          <div class="can-box" aria-live="polite" data-testid="can-box">
            <span class="can-box__title">С такой ролью сотрудник сможет</span>
            <ul>
              <li v-for="permission in permissions" :key="permission">
                <Icon name="check" :size="18" />
                {{ permissionTitle(permission) }}
              </li>
              <li v-if="permissions.length === 0">Ничего: роли не выданы права</li>
            </ul>
          </div>

          <label v-if="mode === 'approve'" class="check">
            <input v-model="notify" type="checkbox" />
            <span>Отправить сотруднику письмо, что доступ открыт</span>
          </label>
        </template>

        <p v-if="error" class="alert" role="alert">{{ error }}</p>
      </div>

      <div class="panel__foot">
        <button class="btn" type="button" :disabled="busy || loading || !!loadError" @click="submit">
          {{ mode === 'approve' ? 'Подтвердить доступ' : 'Сохранить' }}
        </button>
        <button
          v-if="mode === 'approve' && !rejected"
          class="btn btn--danger-soft"
          type="button"
          :disabled="busy"
          @click="emit('reject')"
        >
          Отклонить
        </button>
      </div>
    </div>
  </div>
</template>
