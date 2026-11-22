<script setup lang="ts">
type Name =
  | 'eye'
  | 'eyeOff'
  | 'clock'
  | 'mail'
  | 'arrowLeft'
  | 'check'
  | 'dot'
  | 'requests'
  | 'tasks'
  | 'acts'
  | 'chats'
  | 'contractors'
  | 'staff'
  | 'analytics'
  | 'directories'
  | 'user'
  | 'close'
  | 'chevronDown'
  | 'search'
  | 'dots'
  | 'logout'
  | 'lock';

defineProps<{ name: Name; size?: number }>();

const paths: Record<Name, string> = {
  eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10.7 10.7 0 0112 6c7 0 11 6 11 6a18 18 0 01-3.2 3.9M6.6 6.7A17 17 0 001 12s4 7 11 7c1.8 0 3.4-.4 4.8-1M9.9 9.9a3 3 0 004.2 4.2',
  clock: 'M12 7v5l3 2M12 22a10 10 0 100-20 10 10 0 000 20z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  dot: 'M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0',
  requests: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  tasks: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3ZM8 12l3 3 5-6',
  acts: 'M7 3h7l5 5v13H7ZM14 3v5h5',
  chats: 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  contractors: 'M14 6a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2Z',
  staff:
    'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
  analytics: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  directories: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4ZM5 17a3 3 0 0 1 3-3h11',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21a8 8 0 0 1 16 0',
  close: 'M6 6l12 12M18 6 6 18',
  chevronDown: 'm6 9 6 6 6-6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  dots: 'M12 5h.01M12 12h.01M12 19h.01',
  logout: 'M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 8l4 4-4 4M20 12H9',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6Z',
};
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="paths[name]" />
  </svg>
</template>
