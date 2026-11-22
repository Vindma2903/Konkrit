<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { sectionTitle } from './nav';

const route = useRoute();
// «Заявки» — главная страница (/), остальные — /section/:name
const title = computed(() => sectionTitle(route.params.name ? String(route.params.name) : 'requests'));
</script>

<template>
  <section class="page">
    <h1 class="page__title">{{ title }}</h1>
    <p class="subtitle" data-testid="section-stub">Раздел появится в следующих версиях</p>
  </section>
</template>
