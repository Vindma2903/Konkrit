import { onBeforeUnmount, onMounted, type Ref } from 'vue';

/** Открытые окна: клавиши обрабатывает только верхнее (диалог поверх панели). */
const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Панель или диалог держат фокус внутри себя: Tab не выходит наружу, Esc закрывает,
 * а после закрытия фокус возвращается туда, откуда окно открыли.
 */
export function useFocusTrap(
  root: Ref<HTMLElement | null>,
  onEscape: () => void,
  firstFocus?: string,
  /** Кнопка, с которой открыли окно: Safari не фокусирует кнопку по клику, поэтому activeElement ненадёжен. */
  getOpener?: () => HTMLElement | null | undefined,
) {
  let opener: HTMLElement | null = null;
  const id = Symbol('trap');

  function items(): HTMLElement[] {
    return Array.from(root.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
  }

  function onKeydown(event: KeyboardEvent) {
    if (stack[stack.length - 1] !== id) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    const list = items();
    if (list.length === 0) return;
    const first = list[0]!;
    const last = list[list.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !root.value?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !root.value?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  onMounted(() => {
    opener = getOpener?.() ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const target = (firstFocus && root.value?.querySelector<HTMLElement>(firstFocus)) || items()[0];
    target?.focus();
    stack.push(id);
    document.addEventListener('keydown', onKeydown);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown);
    const index = stack.indexOf(id);
    if (index >= 0) stack.splice(index, 1);
    if (opener && document.contains(opener)) opener.focus();
  });
}
