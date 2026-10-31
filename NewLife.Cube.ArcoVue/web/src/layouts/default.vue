<template>
  <SideLayout />
</template>

<script setup lang="ts">
/** 兼容旧引用；路由父级请使用 RootLayout */
import SideLayout from './side.vue';
</script>

<style scoped>
.layout-content {
  padding: 16px;
}

@media (max-width: 767px) {
  .layout-content {
    padding: 8px;
  }
}

.tab-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
