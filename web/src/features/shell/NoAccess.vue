<template>
  <section class="page" data-testid="no-access">
    <div class="empty-state">
      <h1 class="page__title">Нет доступа</h1>
      <p class="subtitle">У вашей роли нет права открывать этот раздел. Обратитесь к руководителю.</p>
      <RouterLink class="btn btn--ghost btn--inline" :to="{ name: 'cabinet' }">Вернуться на главную</RouterLink>
    </div>
  </section>
</template>
