import { defineStore } from 'pinia';
import { ref } from 'vue';

const SHOW_MS = 4000;

/** Короткое сообщение об успешном действии («Доступ открыт: Иван Новиков»). */
export const useToastStore = defineStore('toast', () => {
  const message = ref('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function show(text: string) {
    message.value = text;
    clearTimeout(timer);
    timer = setTimeout(() => {
      message.value = '';
    }, SHOW_MS);
  }

  function clear() {
    clearTimeout(timer);
    message.value = '';
  }

  return { message, show, clear };
});
