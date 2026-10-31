<template>
  <div class="wrap wrap--narrow">
    <div class="not-found">
      <p class="not-found__code">404</p>
      <p class="not-found__text">这一页不存在，可能已经被删掉了。</p>
      <router-link to="/" class="hero__link">回到首页</router-link>
    </div>
  </div>
</template>

<script setup></script>

<style scoped>
.not-found {
  padding: 80px 0 60px;
  text-align: center;
}

.not-found__code {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.2em;
  color: var(--text-3);
}

.not-found__text {
  margin: 14px 0 26px;
  font-size: 15px;
  color: var(--text-2);
}
</style>
