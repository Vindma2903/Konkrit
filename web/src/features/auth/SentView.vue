<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getApi } from '@/api';
import { useFlowStore } from '@/stores/flow';
import AuthLayout from './AuthLayout.vue';
import Icon from './Icon.vue';
import { commonMessage, useNow } from './form';

const router = useRouter();
const flow = useFlowStore();
const now = useNow();

const recovery = computed(() => flow.recovery);
const secondsLeft = computed(() =>
  recovery.value ? Math.max(0, Math.ceil((recovery.value.availableAt - now.value) / 1000)) : 0,
);
const submitting = ref(false);
const status = ref('');
const error = ref('');
const demo = import.meta.env.DEV;

function minutesWord(n: number): string {
  const last = n % 10;
  const tens = n % 100;
  if (last === 1 && tens !== 11) return 'минуту';
  if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) return 'минуты';
  return 'минут';
}

async function resend() {
  const current = recovery.value;
  if (!current || submitting.value || secondsLeft.value > 0) return;
  submitting.value = true;
  status.value = '';
  error.value = '';
  try {
    const result = await getApi().forgotPassword({ email: current.email });
    flow.setRecovery({ email: current.email, ttlMin: result.ttlMin, availableAt: Date.now() + result.retryAfterSec * 1000 });
    now.value = Date.now();
    status.value = 'Письмо отправлено снова';
  } catch (e) {
    error.value = commonMessage(e);
  } finally {
    submitting.value = false;
  }
}

function openDemo() {
  // Только для разработки с моком; в релизной сборке тело функции вырезается
  if (import.meta.env.DEV) void router.push({ name: 'reset', query: { token: 'demo' } });
}
</script>

<template>
  <AuthLayout>
    <div v-if="recovery" class="stack center">
      <div class="badge badge--coral"><Icon name="mail" :size="32" /></div>
      <h1 class="title">Проверьте почту</h1>
      <p class="subtitle">
        Мы отправили ссылку для восстановления на {{ recovery.email }}.
        Она действует {{ recovery.ttlMin }} {{ minutesWord(recovery.ttlMin) }}.
      </p>
    </div>
    <button v-if="demo" class="btn" type="button" @click="openDemo">Открыть пример письма</button>
    <div class="stack center">
      <p class="hint">Письма нет?</p>
      <button class="btn btn--ghost" type="button" :disabled="secondsLeft > 0 || submitting" @click="resend">
        {{ secondsLeft > 0 ? `Отправить ещё раз через ${secondsLeft} с` : 'Отправить ещё раз' }}
      </button>
      <p v-if="status" class="notice" role="status">{{ status }}</p>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
    </div>
    <RouterLink class="link" :to="{ name: 'login' }">Вернуться ко входу</RouterLink>
  </AuthLayout>
</template>
