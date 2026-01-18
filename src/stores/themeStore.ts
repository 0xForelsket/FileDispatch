import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "classic" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "classic",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "classic" ? "dark" : "classic" })),
    }),
    {
      name: "theme-storage",
    },
  ),
);
