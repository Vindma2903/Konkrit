<template>
  <div class="auth">
    <aside class="auth__brand">
      <div class="logo">
        <span class="logo__mark" aria-hidden="true">К</span>
        <span>Конкрит</span>
      </div>
      <div>
        <h2>Единая платформа для управляющей компании</h2>
        <ul class="auth__points">
          <li>Заявки жителей в одном окне</li>
          <li>Задачи, акты и чаты</li>
          <li>Аналитика и KPI по сотрудникам</li>
        </ul>
      </div>
      <p class="auth__caption">Кабинет сотрудников УК</p>
    </aside>
    <main class="auth__main">
      <div class="logo auth__logo-mobile">
        <span class="logo__mark" aria-hidden="true">К</span>
        <span>Конкрит</span>
      </div>
      <div class="auth__card">
        <slot />
      </div>
    </main>
  </div>
</template>
