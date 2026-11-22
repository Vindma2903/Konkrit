import { defineStore } from 'pinia';
import { ref } from 'vue';

const RECOVERY_KEY = 'staff-recovery';

export type Recovery = { email: string; ttlMin: number; availableAt: number };

function loadRecovery(): Recovery | null {
  try {
    const raw = sessionStorage.getItem(RECOVERY_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Recovery;
    return typeof value.email === 'string' && typeof value.availableAt === 'number' ? value : null;
  } catch {
    return null;
  }
}

/** Данные, которые переходят между экранами авторизации. Пароли здесь не хранятся. */
export const useFlowStore = defineStore('flow', () => {
  /** Заявка на доступ: нужна экрану «Ждём подтверждения»; при перезагрузке теряется. */
  const pending = ref<{ company: string; email: string; adminEmail: string } | null>(null);
  /** Почта, введённая на входе, для экрана восстановления. */
  const emailDraft = ref('');
  /** Одноразовое сообщение для экрана входа. */
  const notice = ref('');
  /** Отправленное письмо восстановления; переживает перезагрузку, чтобы таймер не обнулялся. */
  const recovery = ref<Recovery | null>(loadRecovery());

  function setRecovery(value: Recovery | null) {
    recovery.value = value;
    try {
      if (value) sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(RECOVERY_KEY);
    } catch {
      // без хранилища таймер просто не переживёт перезагрузку
    }
  }

  function takeNotice(): string {
    const text = notice.value;
    notice.value = '';
    return text;
  }

  return { pending, emailDraft, notice, recovery, setRecovery, takeNotice };
});
