import { ref, watchEffect } from "vue";

export function useTheme() {
  const isDark = ref(false);
  watchEffect(() => {
    const el = document.documentElement;
    if (isDark.value) el.classList.add("dark");
    else el.classList.remove("dark");
  });
  return {
    isDark,
    setDark(v: boolean) {
      isDark.value = !!v;
    },
    toggle() {
      isDark.value = !isDark.value;
    },
  };
}

export const version = "0.0.1";
