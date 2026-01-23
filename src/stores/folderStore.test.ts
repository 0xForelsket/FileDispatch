import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { Folder } from "@/types";

// Create mock function
type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
const mockInvoke = mock<InvokeFn>(() => Promise.resolve(null));

// Mock the Tauri invoke at the source
mock.module("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

// Import store after mocking
const { useFolderStore } = await import("./folderStore");

const createMockFolder = (overrides: Partial<Folder> = {}): Folder => ({
  id: "folder-1",
  path: "/path/to/folder",
  name: "Test Folder",
  enabled: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  scanDepth: 1,
  removeDuplicates: false,
  trashIncompleteDownloads: false,
  incompleteTimeoutMinutes: 5,
  isGroup: false,
  ...overrides,
});

describe("useFolderStore", () => {
  beforeEach(() => {
    // Reset store state
    useFolderStore.setState({
      folders: [],
      selectedFolderId: undefined,
      loading: false,
      error: undefined,
    });

    mockInvoke.mockClear();
  });

  afterEach(() => {
    mockInvoke.mockReset();
  });

  describe("initial state", () => {
    test("starts with empty folders array", () => {
      const state = useFolderStore.getState();
      expect(state.folders).toEqual([]);
      expect(state.selectedFolderId).toBeUndefined();
      expect(state.loading).toBe(false);
      expect(state.error).toBeUndefined();
    });
  });

  describe("loadFolders", () => {
    test("loads folders from backend", async () => {
      const mockFolders = [
        createMockFolder({ id: "folder-1", name: "Folder 1" }),
        createMockFolder({ id: "folder-2", name: "Folder 2" }),
      ];
      mockInvoke.mockResolvedValueOnce(mockFolders);

      await useFolderStore.getState().loadFolders();

      const state = useFolderStore.getState();
      expect(state.folders).toEqual(mockFolders);
      expect(state.loading).toBe(false);
      expect(state.error).toBeUndefined();
      expect(mockInvoke).toHaveBeenCalledWith("folder_list");
    });

    test("selects first folder if none selected", async () => {
      const mockFolders = [
        createMockFolder({ id: "folder-1" }),
        createMockFolder({ id: "folder-2" }),
      ];
      mockInvoke.mockResolvedValueOnce(mockFolders);

      await useFolderStore.getState().loadFolders();

      expect(useFolderStore.getState().selectedFolderId).toBe("folder-1");
    });

    test("preserves selected folder if already set", async () => {
      useFolderStore.setState({ selectedFolderId: "folder-2" });

      const mockFolders = [
        createMockFolder({ id: "folder-1" }),
        createMockFolder({ id: "folder-2" }),
      ];
      mockInvoke.mockResolvedValueOnce(mockFolders);

      await useFolderStore.getState().loadFolders();

      expect(useFolderStore.getState().selectedFolderId).toBe("folder-2");
    });

    test("handles errors from backend", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Network error"));

      await useFolderStore.getState().loadFolders();

      const state = useFolderStore.getState();
      expect(state.error).toContain("Network error");
      expect(state.loading).toBe(false);
    });
  });

  describe("addFolder", () => {
    test("adds folder and reloads list", async () => {
      const newFolder = createMockFolder({ id: "new-folder" });
      mockInvoke
        .mockResolvedValueOnce(newFolder) // folder_add
        .mockResolvedValueOnce([newFolder]); // folder_list

      await useFolderStore.getState().addFolder("/path/to/new", "New Folder");

      expect(mockInvoke).toHaveBeenCalledWith("folder_add", { path: "/path/to/new", name: "New Folder" });
      expect(mockInvoke).toHaveBeenCalledWith("folder_list");
    });

    test("handles add errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Add failed"));

      await useFolderStore.getState().addFolder("/path", "Name");

      expect(useFolderStore.getState().error).toContain("Add failed");
    });
  });

  describe("removeFolder", () => {
    test("removes folder and reloads list", async () => {
      useFolderStore.setState({
        folders: [createMockFolder({ id: "folder-1" })],
        selectedFolderId: "folder-1",
      });

      mockInvoke
        .mockResolvedValueOnce(undefined) // folder_remove
        .mockResolvedValueOnce([]); // folder_list

      await useFolderStore.getState().removeFolder("folder-1");

      expect(mockInvoke).toHaveBeenCalledWith("folder_remove", { id: "folder-1" });
      expect(mockInvoke).toHaveBeenCalledWith("folder_list");
    });

    test("selects next folder when selected folder is removed", async () => {
      const folder1 = createMockFolder({ id: "folder-1" });
      const folder2 = createMockFolder({ id: "folder-2" });
      useFolderStore.setState({
        folders: [folder1, folder2],
        selectedFolderId: "folder-1",
      });

      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([folder2]);

      await useFolderStore.getState().removeFolder("folder-1");

      expect(useFolderStore.getState().selectedFolderId).toBe("folder-2");
    });

    test("handles remove errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Remove failed"));

      await useFolderStore.getState().removeFolder("folder-1");

      expect(useFolderStore.getState().error).toContain("Remove failed");
    });
  });

  describe("toggleFolder", () => {
    test("toggles folder enabled state", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([createMockFolder({ enabled: false })]);

      await useFolderStore.getState().toggleFolder("folder-1", false);

      expect(mockInvoke).toHaveBeenCalledWith("folder_toggle", { id: "folder-1", enabled: false });
      expect(mockInvoke).toHaveBeenCalledWith("folder_list");
    });

    test("handles toggle errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Toggle failed"));

      await useFolderStore.getState().toggleFolder("folder-1", true);

      expect(useFolderStore.getState().error).toContain("Toggle failed");
    });
  });

  describe("updateFolderSettings", () => {
    test("updates folder settings", async () => {
      const settings = {
        scanDepth: 2,
        removeDuplicates: true,
        trashIncompleteDownloads: false,
        incompleteTimeoutMinutes: 10,
      };
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([createMockFolder(settings)]);

      await useFolderStore.getState().updateFolderSettings("folder-1", settings);

      expect(mockInvoke).toHaveBeenCalledWith("folder_update_settings", { id: "folder-1", ...settings });
      expect(mockInvoke).toHaveBeenCalledWith("folder_list");
    });

    test("handles update settings errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Update failed"));

      await useFolderStore.getState().updateFolderSettings("folder-1", {
        scanDepth: 1,
        removeDuplicates: false,
        trashIncompleteDownloads: false,
        incompleteTimeoutMinutes: 5,
      });

      expect(useFolderStore.getState().error).toContain("Update failed");
    });
  });

  describe("createGroup", () => {
    test("creates folder group", async () => {
      const newGroup = createMockFolder({ id: "group-1", isGroup: true });
      mockInvoke
        .mockResolvedValueOnce(newGroup)
        .mockResolvedValueOnce([newGroup]);

      await useFolderStore.getState().createGroup("My Group", "parent-1");

      expect(mockInvoke).toHaveBeenCalledWith("folder_create_group", { name: "My Group", parentId: "parent-1" });
      expect(mockInvoke).toHaveBeenCalledWith("folder_list");
    });

    test("creates group without parent", async () => {
      mockInvoke
        .mockResolvedValueOnce(createMockFolder({ isGroup: true }))
        .mockResolvedValueOnce([]);

      await useFolderStore.getState().createGroup("Root Group", undefined);

      expect(mockInvoke).toHaveBeenCalledWith("folder_create_group", { name: "Root Group", parentId: undefined });
    });

    test("handles create group errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Create group failed"));

      await useFolderStore.getState().createGroup("Group", undefined);

      expect(useFolderStore.getState().error).toContain("Create group failed");
    });
  });

  describe("moveFolder", () => {
    test("moves folder to new parent", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);

      await useFolderStore.getState().moveFolder("folder-1", "parent-1");

      expect(mockInvoke).toHaveBeenCalledWith("folder_move", { id: "folder-1", parentId: "parent-1" });
      expect(mockInvoke).toHaveBeenCalledWith("folder_list");
    });

    test("moves folder to root (no parent)", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([]);

      await useFolderStore.getState().moveFolder("folder-1", undefined);

      expect(mockInvoke).toHaveBeenCalledWith("folder_move", { id: "folder-1", parentId: undefined });
    });

    test("handles move errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Move failed"));

      await useFolderStore.getState().moveFolder("folder-1", "parent-1");

      expect(useFolderStore.getState().error).toContain("Move failed");
    });
  });

  describe("renameFolder", () => {
    test("renames folder", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([createMockFolder({ name: "New Name" })]);

      await useFolderStore.getState().renameFolder("folder-1", "New Name");

      expect(mockInvoke).toHaveBeenCalledWith("folder_rename", { id: "folder-1", name: "New Name" });
      expect(mockInvoke).toHaveBeenCalledWith("folder_list");
    });

    test("handles rename errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Rename failed"));

      await useFolderStore.getState().renameFolder("folder-1", "New Name");

      expect(useFolderStore.getState().error).toContain("Rename failed");
    });
  });

  describe("selectFolder", () => {
    test("sets selected folder id", () => {
      useFolderStore.getState().selectFolder("folder-2");

      expect(useFolderStore.getState().selectedFolderId).toBe("folder-2");
    });

    test("clears selected folder when undefined", () => {
      useFolderStore.setState({ selectedFolderId: "folder-1" });

      useFolderStore.getState().selectFolder(undefined);

      expect(useFolderStore.getState().selectedFolderId).toBeUndefined();
    });
  });
});
