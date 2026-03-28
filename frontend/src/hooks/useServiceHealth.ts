import { useEffect, useState } from "react";
import { getDocumentHealth, getRagHealth } from "../lib/api";
import type { HealthState } from "../types";

export function useServiceHealth() {
  const [ragHealth, setRagHealth] = useState<HealthState>("checking");
  const [documentHealth, setDocumentHealth] = useState<HealthState>("checking");
  const [refreshingHealth, setRefreshingHealth] = useState(false);

  useEffect(() => {
    void refreshHealth();
  }, []);

  async function refreshHealth() {
    setRefreshingHealth(true);
    setRagHealth("checking");
    setDocumentHealth("checking");

    try {
      await Promise.all([
        getRagHealth().then(() => setRagHealth("ok")).catch(() => setRagHealth("error")),
        getDocumentHealth()
          .then(() => setDocumentHealth("ok"))
          .catch(() => setDocumentHealth("error"))
      ]);
    } finally {
      setRefreshingHealth(false);
    }
  }

  return {
    ragHealth,
    documentHealth,
    refreshingHealth,
    refreshHealth
  };
}
