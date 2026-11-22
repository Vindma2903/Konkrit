<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError, getApi } from '@/api';
import { useFlowStore } from '@/stores/flow';
import AuthLayout from './AuthLayout.vue';
import PasswordField from './PasswordField.vue';
import PasswordRules from './PasswordRules.vue';
import { commonMessage, focusFirstInvalid } from './form';
import { passwordOk } from './validators';

const route = useRoute();
const router = useRouter();
const flow = useFlowStore();

// Токен хранится только здесь и сразу убирается из адресной строки и истории
let token = typeof route.query.token === 'string' ? route.query.token : '';
if (route.query.token !== undefined) void router.replace({ name: 'reset' });

const form = ref<HTMLFormElement | null>(null);
const invalid = ref(!token);
const password = ref('');
const repeat = ref('');
const errors = ref<{ password?: string; repeat?: string }>({});
const attempted = ref(false);
const formError = ref('');
const submitting = ref(false);

// Экран переиспользуется, если в этой же вкладке открыли другую ссылку из письма
watch(
  () => route.query.token,
  (value) => {
    if (typeof value !== 'string') return;
    token = value;
    invalid.value = false;
    void router.replace({ name: 'reset' });
  },
);

async function submit() {
  if (submitting.value) return;
  formError.value = '';
  attempted.value = true;
  const next: typeof errors.value = {};
  if (!passwordOk(password.value)) next.password = 'Пароль не подходит под требования';
  if (repeat.value !== password.value) next.repeat = 'Пароли не совпадают';
  errors.value = next;
  if (next.password || next.repeat) {
    await focusFirstInvalid(form.value);
    return;
  }
  submitting.value = true;
  try {
    await getApi().resetPassword({ token, password: password.value });
    flow.setRecovery(null);
    flow.notice = 'Пароль изменён. Войдите с новым паролем';
    await router.replace({ name: 'login' });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'invalid_token') {
      invalid.value = true;
    } else if (error instanceof ApiError && error.code === 'validation' && error.fields?.password) {
      errors.value = { password: error.fields.password };
      await focusFirstInvalid(form.value);
    } else {
      formError.value = commonMessage(error);
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <template v-if="invalid">
      <div class="stack center">
        <h1 class="title">Ссылка больше не действует</h1>
        <p class="subtitle">Она могла истечь или уже быть использованной. Запросите новую ссылку.</p>
      </div>
      <RouterLink class="btn" :to="{ name: 'forgot' }">Запросить новую ссылку</RouterLink>
    </template>
    <template v-else>
      <div class="stack">
        <h1 class="title">Новый пароль</h1>
        <p class="subtitle">Придумайте пароль, которого раньше не использовали.</p>
      </div>
      <form ref="form" class="stack" novalidate @submit.prevent="submit">
        <PasswordField v-model="password" label="Новый пароль" autocomplete="new-password" :error="errors.password" />
        <PasswordField v-model="repeat" label="Повторите пароль" autocomplete="new-password" :error="errors.repeat" />
        <PasswordRules :password="password" :show-failures="attempted" />
        <p v-if="formError" class="alert" role="alert">{{ formError }}</p>
        <button class="btn" type="submit" :disabled="submitting">Сохранить пароль</button>
      </form>
    </template>
  </AuthLayout>
</template>
