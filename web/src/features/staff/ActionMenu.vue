<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import Icon from '@/features/auth/Icon.vue';

export type MenuAction = { key: string; label: string; danger?: boolean };

defineProps<{ label: string; actions: MenuAction[] }>();
const emit = defineEmits<{ select: [key: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);

function items(): HTMLElement[] {
  return Array.from(root.value?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []);
}

function onOutside(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) close(false);
}

async function toggle() {
  if (open.value) return close(true);
  open.value = true;
  await nextTick();
  items()[0]?.focus();
  document.addEventListener('mousedown', onOutside);
}

function close(returnFocus: boolean) {
  open.value = false;
  document.removeEventListener('mousedown', onOutside);
  if (returnFocus) button.value?.focus();
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return;
  const list = items();
  const index = list.indexOf(document.activeElement as HTMLElement);
  if (event.key === 'Escape') {
    event.stopPropagation();
    close(true);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    list[(index + 1) % list.length]?.focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    list[(index - 1 + list.length) % list.length]?.focus();
  } else if (event.key === 'Tab') {
    close(false);
  }
}

function choose(key: string) {
  close(true);
  emit('select', key);
}

onBeforeUnmount(() => document.removeEventListener('mousedown', onOutside));
</script>

<template>
  <div ref="root" class="menu" @keydown="onKeydown">
    <button
      ref="button"
      class="icon-btn"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="label"
      @click.stop="toggle"
    >
      <Icon name="dots" />
    </button>
    <div v-if="open" class="menu__list" role="menu" :aria-label="label">
      <button
        v-for="action in actions"
        :key="action.key"
        class="menu-item"
        :class="{ 'menu-item--danger': action.danger }"
        type="button"
        role="menuitem"
        @click.stop="choose(action.key)"
      >
        {{ action.label }}
      </button>
    </div>
  </div>
</template>
