import { onMounted, ref } from "vue";
import { getDocumentHealth, getRagHealth } from "../lib/api";
import type { HealthState } from "../types";

export function useServiceHealth() {
  const ragHealth = ref<HealthState>("checking");
  const documentHealth = ref<HealthState>("checking");
  const refreshingHealth = ref(false);

  onMounted(() => {
    void refreshHealth();
  });

  async function refreshHealth() {
    refreshingHealth.value = true;
    ragHealth.value = "checking";
    documentHealth.value = "checking";

    try {
      await Promise.all([
        getRagHealth()
          .then(() => {
            ragHealth.value = "ok";
          })
          .catch(() => {
            ragHealth.value = "error";
          }),
        getDocumentHealth()
          .then(() => {
            documentHealth.value = "ok";
          })
          .catch(() => {
            documentHealth.value = "error";
          })
      ]);
    } finally {
      refreshingHealth.value = false;
    }
  }

  return {
    ragHealth,
    documentHealth,
    refreshingHealth,
    refreshHealth
  };
}
