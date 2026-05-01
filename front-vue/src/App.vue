<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <a-app>
      <router-view />
    </a-app>
  </a-config-provider>
</template>

<script setup lang="ts">
import zhCN from "ant-design-vue/es/locale/zh_CN";

const theme = {
  token: {
    colorPrimary: "#f25b2a",
    colorInfo: "#f25b2a",
    colorSuccess: "#1d8f6f",
    borderRadius: 22,
    fontFamily:
      '"Space Grotesk", "Noto Sans SC", "Segoe UI", "PingFang SC", sans-serif'
  }
};
</script>
