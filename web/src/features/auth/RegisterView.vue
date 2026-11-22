<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError } from '@/api';
import { getApi } from '@/api';
import { useFlowStore } from '@/stores/flow';
import AuthLayout from './AuthLayout.vue';
import PasswordField from './PasswordField.vue';
import TextField from './TextField.vue';
import { commonMessage, focusFirstInvalid } from './form';
import { isEmail, isFullName, isPhone, nextPhoneValue, toE164 } from './validators';

type Field = 'name' | 'company' | 'email' | 'phone' | 'password' | 'repeat' | 'consent';

const router = useRouter();
const flow = useFlowStore();

const form = ref<HTMLFormElement | null>(null);
const name = ref('');
const company = ref('');
const email = ref('');
const phone = ref('');
const password = ref('');
const repeat = ref('');
const consent = ref(false);
const errors = ref<Partial<Record<Field, string>>>({});
const formError = ref('');
const emailTaken = ref(false);
const submitting = ref(false);

const REQUIRED = 'Заполните поле';

function validate(): boolean {
  const next: Partial<Record<Field, string>> = {};
  if (!name.value.trim()) next.name = REQUIRED;
  else if (!isFullName(name.value)) next.name = 'Укажите имя и фамилию';
  if (!company.value.trim()) next.company = REQUIRED;
  if (!email.value.trim()) next.email = REQUIRED;
  else if (!isEmail(email.value)) next.email = 'Проверьте адрес почты';
  if (!phone.value) next.phone = REQUIRED;
  else if (!isPhone(phone.value)) next.phone = 'Проверьте номер телефона';
  if (!password.value) next.password = REQUIRED;
  else if (password.value.length < 8) next.password = 'Пароль не короче 8 символов';
  if (!repeat.value) next.repeat = REQUIRED;
  else if (repeat.value !== password.value) next.repeat = 'Пароли не совпадают';
  if (!consent.value) next.consent = 'Нужно согласие, чтобы продолжить';
  errors.value = next;
  return Object.keys(next).length === 0;
}

function onPhone(raw: string) {
  phone.value = nextPhoneValue(phone.value, raw);
}

async function submit() {
  if (submitting.value) return;
  formError.value = '';
  emailTaken.value = false;
  if (!validate()) {
    await focusFirstInvalid(form.value);
    return;
  }
  submitting.value = true;
  try {
    const result = await getApi().register({
      name: name.value.trim().replace(/\s+/g, ' '),
      company: company.value.trim(),
      email: email.value.trim(),
      phone: toE164(phone.value),
      password: password.value,
      consent: consent.value,
    });
    flow.pending = { company: result.company, email: email.value.trim(), adminEmail: result.adminEmail };
    await router.push({ name: 'pending' });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'email_taken') {
      emailTaken.value = true;
      errors.value = { email: 'Аккаунт с такой почтой уже есть' };
      await focusFirstInvalid(form.value);
    } else if (error instanceof ApiError && error.code === 'validation' && error.fields) {
      const known: Field[] = ['name', 'company', 'email', 'phone', 'password'];
      const next: Partial<Record<Field, string>> = {};
      for (const key of known) if (error.fields[key]) next[key] = error.fields[key];
      errors.value = next;
      if (Object.keys(next).length === 0) formError.value = commonMessage(error);
      else await focusFirstInvalid(form.value);
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
    <div class="stack">
      <h1 class="title">Регистрация</h1>
      <p class="subtitle">Создайте аккаунт сотрудника. Администратор УК подтвердит доступ.</p>
    </div>
    <form ref="form" class="stack" novalidate @submit.prevent="submit">
      <TextField v-model="name" label="Имя и фамилия" autocomplete="name" :error="errors.name" />
      <TextField
        v-model="company"
        label="Управляющая компания"
        autocomplete="organization"
        placeholder="Название УК"
        :error="errors.company"
      />
      <TextField
        v-model="email"
        label="Электронная почта"
        type="email"
        autocomplete="email"
        inputmode="email"
        placeholder="email@company.ru"
        :error="errors.email"
      />
      <RouterLink v-if="emailTaken" class="link" :to="{ name: 'login' }">Войти</RouterLink>
      <TextField
        :model-value="phone"
        label="Телефон"
        type="tel"
        autocomplete="tel"
        inputmode="tel"
        placeholder="+7 …"
        :error="errors.phone"
        @update:model-value="onPhone"
      />
      <PasswordField
        v-model="password"
        label="Пароль"
        autocomplete="new-password"
        placeholder="Не короче 8 символов"
        :error="errors.password"
      />
      <PasswordField
        v-model="repeat"
        label="Повторите пароль"
        autocomplete="new-password"
        placeholder="Ещё раз пароль"
        :error="errors.repeat"
      />
      <div class="field">
        <label class="check">
          <input
            v-model="consent"
            type="checkbox"
            :aria-invalid="errors.consent ? 'true' : 'false'"
            :aria-describedby="errors.consent ? 'consent-error' : undefined"
          />
          <span class="check__text">
            Согласен с
            <a class="link" href="/legal/terms.html" target="_blank" rel="noopener noreferrer">условиями использования</a>
            и
            <a class="link" href="/legal/privacy.html" target="_blank" rel="noopener noreferrer">обработкой персональных данных</a>
          </span>
        </label>
        <p v-if="errors.consent" id="consent-error" class="field__error" role="alert">{{ errors.consent }}</p>
      </div>
      <p v-if="formError" class="alert" role="alert">{{ formError }}</p>
      <button class="btn" type="submit" :disabled="submitting">Создать аккаунт</button>
    </form>
    <p class="hint">
      Уже есть аккаунт?
      <RouterLink class="link" :to="{ name: 'login' }">Войти</RouterLink>
    </p>
  </AuthLayout>
</template>
