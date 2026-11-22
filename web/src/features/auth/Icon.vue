<script setup lang="ts">
type Name = 'eye' | 'eyeOff' | 'clock' | 'mail' | 'arrowLeft' | 'check' | 'dot';

defineProps<{ name: Name; size?: number }>();

const paths: Record<Name, string> = {
  eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10.7 10.7 0 0112 6c7 0 11 6 11 6a18 18 0 01-3.2 3.9M6.6 6.7A17 17 0 001 12s4 7 11 7c1.8 0 3.4-.4 4.8-1M9.9 9.9a3 3 0 004.2 4.2',
  clock: 'M12 7v5l3 2M12 22a10 10 0 100-20 10 10 0 000 20z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  dot: 'M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0',
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
