import { create } from "zustand";

interface EditorState {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  isDirty: false,
  setDirty: (dirty) => set({ isDirty: dirty }),
}));
