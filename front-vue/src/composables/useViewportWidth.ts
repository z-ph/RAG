import { onBeforeUnmount, onMounted, ref } from "vue";

export function useViewportWidth() {
  const width = ref(typeof window === "undefined" ? 1440 : window.innerWidth);

  function syncWidth() {
    width.value = window.innerWidth;
  }

  onMounted(() => {
    syncWidth();
    window.addEventListener("resize", syncWidth);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("resize", syncWidth);
  });

  return {
    width
  };
}
