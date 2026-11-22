<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { getApi } from '@/api';
import { useFlowStore } from '@/stores/flow';
import AuthLayout from './AuthLayout.vue';
import Icon from './Icon.vue';
import TextField from './TextField.vue';
import { commonMessage, focusFirstInvalid } from './form';
import { isEmail } from './validators';

const router = useRouter();
const flow = useFlowStore();

const form = ref<HTMLFormElement | null>(null);
const email = ref(flow.emailDraft);
const error = ref('');
const formError = ref('');
const submitting = ref(false);

async function submit() {
  if (submitting.value) return;
  formError.value = '';
  const value = email.value.trim();
  if (!value) error.value = 'Введите почту';
  else if (!isEmail(value)) error.value = 'Проверьте адрес почты';
  else error.value = '';
  if (error.value) {
    await focusFirstInvalid(form.value);
    return;
  }
  submitting.value = true;
  try {
    const result = await getApi().forgotPassword({ email: value });
    flow.setRecovery({ email: value, ttlMin: result.ttlMin, availableAt: Date.now() + result.retryAfterSec * 1000 });
    await router.push({ name: 'forgot-sent' });
  } catch (e) {
    formError.value = commonMessage(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <RouterLink class="link" :to="{ name: 'login' }">
      <Icon name="arrowLeft" :size="18" />
      Вернуться ко входу
    </RouterLink>
    <div class="stack">
      <h1 class="title">Восстановление пароля</h1>
      <p class="subtitle">Укажите почту, на неё придёт ссылка для создания нового пароля.</p>
    </div>
    <form ref="form" class="stack" novalidate @submit.prevent="submit">
      <TextField
        v-model="email"
        label="Электронная почта"
        type="email"
        autocomplete="username"
        inputmode="email"
        placeholder="email@company.ru"
        :error="error"
      />
      <p v-if="formError" class="alert" role="alert">{{ formError }}</p>
      <button class="btn" type="submit" :disabled="submitting">Отправить ссылку</button>
    </form>
  </AuthLayout>
</template>
