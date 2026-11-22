<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '@/api';
import { useFlowStore } from '@/stores/flow';
import { useSessionStore } from '@/stores/session';
import AuthLayout from './AuthLayout.vue';
import PasswordField from './PasswordField.vue';
import TextField from './TextField.vue';
import { commonMessage, focusFirstInvalid, rateLimitMessage, useNow } from './form';
import { isEmail, safeNext } from './validators';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const flow = useFlowStore();

const form = ref<HTMLFormElement | null>(null);
const email = ref('');
const password = ref('');
const remember = ref(true);
const errors = ref<{ email?: string; password?: string }>({});
const formError = ref('');
const submitting = ref(false);
const blockedUntil = ref(0);
const notice = flow.takeNotice();

const now = useNow();
const remaining = computed(() => Math.max(0, Math.ceil((blockedUntil.value - now.value) / 1000)));
const blocked = computed(() => remaining.value > 0);
const limitMessage = ref('');
// Текст фиксируется в момент блокировки, чтобы скринридер не зачитывал его заново при каждом тике
const message = computed(() => (blocked.value ? limitMessage.value : formError.value));

function validate(): boolean {
  const next: typeof errors.value = {};
  if (!email.value.trim()) next.email = 'Введите почту';
  else if (!isEmail(email.value)) next.email = 'Проверьте адрес почты';
  if (!password.value) next.password = 'Введите пароль';
  errors.value = next;
  return !next.email && !next.password;
}

async function submit() {
  if (submitting.value || blocked.value) return;
  formError.value = '';
  if (!validate()) {
    await focusFirstInvalid(form.value);
    return;
  }
  submitting.value = true;
  try {
    await session.login({ email: email.value.trim(), password: password.value, remember: remember.value });
    flow.setRecovery(null);
    await router.replace(safeNext(route.query.next) ?? '/');
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'invalid_credentials') {
        formError.value = 'Неверная почта или пароль';
        return;
      }
      if (error.code === 'pending_approval') {
        flow.pending = {
          company: error.fields?.company ?? '',
          email: email.value.trim(),
          adminEmail: error.fields?.adminEmail ?? '',
        };
        await router.push({ name: 'pending' });
        return;
      }
      if (error.code === 'rejected') {
        formError.value = 'Доступ не открыт. Обратитесь к администратору УК';
        return;
      }
      if (error.code === 'blocked') {
        formError.value = 'Доступ закрыт. Обратитесь к администратору УК';
        return;
      }
      if (error.code === 'rate_limited') {
        limitMessage.value = rateLimitMessage(error.retryAfterSec ?? 60);
        blockedUntil.value = Date.now() + (error.retryAfterSec ?? 60) * 1000;
        now.value = Date.now();
        return;
      }
    }
    formError.value = commonMessage(error);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <div class="stack">
      <h1 class="title">Вход</h1>
      <p class="subtitle">Войдите в кабинет, чтобы работать с заявками и задачами.</p>
    </div>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <form ref="form" class="stack" novalidate @submit.prevent="submit">
      <TextField
        v-model="email"
        label="Электронная почта"
        type="email"
        autocomplete="username"
        inputmode="email"
        placeholder="email@company.ru"
        :error="errors.email"
      />
      <PasswordField
        v-model="password"
        label="Пароль"
        autocomplete="current-password"
        placeholder="Введите пароль"
        :error="errors.password"
      />
      <div class="row">
        <label class="check">
          <input v-model="remember" type="checkbox" />
          <span class="check__text">Запомнить меня</span>
        </label>
        <RouterLink class="link" :to="{ name: 'forgot' }" @click="flow.emailDraft = email.trim()">
          Забыли пароль?
        </RouterLink>
      </div>
      <p v-if="message" class="alert" role="alert">{{ message }}</p>
      <button class="btn" type="submit" :disabled="submitting || blocked">Войти</button>
    </form>
    <p class="hint">
      Нет аккаунта?
      <RouterLink class="link" :to="{ name: 'register' }">Зарегистрироваться</RouterLink>
    </p>
  </AuthLayout>
</template>
