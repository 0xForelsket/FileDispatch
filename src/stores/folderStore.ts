import { create } from "zustand";

import type { Folder } from "@/types";
import { folderAdd, folderList, folderRemove, folderToggle, folderUpdateSettings } from "@/lib/tauri";

interface FolderState {
  folders: Folder[];
  selectedFolderId?: string;
  loading: boolean;
  error?: string;
  loadFolders: () => Promise<void>;
  addFolder: (path: string, name: string) => Promise<void>;
  removeFolder: (id: string) => Promise<void>;
  toggleFolder: (id: string, enabled: boolean) => Promise<void>;
  updateFolderSettings: (id: string, scanDepth: number) => Promise<void>;
  selectFolder: (id?: string) => void;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  selectedFolderId: undefined,
  loading: false,
  error: undefined,
  loadFolders: async () => {
    set({ loading: true, error: undefined });
    try {
      const folders = await folderList();
      const selected = get().selectedFolderId;
      set({
        folders,
        selectedFolderId: selected ?? folders[0]?.id,
        loading: false,
      });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  addFolder: async (path, name) => {
    set({ loading: true, error: undefined });
    try {
      await folderAdd(path, name);
      await get().loadFolders();
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  removeFolder: async (id) => {
    set({ loading: true, error: undefined });
    try {
      await folderRemove(id);
      const selected = get().selectedFolderId;
      await get().loadFolders();
      if (selected === id) {
        const next = get().folders[0]?.id;
        set({ selectedFolderId: next });
      }
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  toggleFolder: async (id, enabled) => {
    set({ loading: true, error: undefined });
    try {
      await folderToggle(id, enabled);
      await get().loadFolders();
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  updateFolderSettings: async (id, scanDepth) => {
    set({ loading: true, error: undefined });
    try {
      await folderUpdateSettings(id, scanDepth);
      await get().loadFolders();
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
  selectFolder: (id) => set({ selectedFolderId: id }),
}));
