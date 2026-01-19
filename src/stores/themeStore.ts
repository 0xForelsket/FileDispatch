import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "magi" | "dark" | "light";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "magi",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "magi" ? "dark" : "magi" })),
    }),
    {
      name: "theme-storage",
    },
  ),
);
