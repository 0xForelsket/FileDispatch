
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";


import { useFolderStore } from "@/stores/folderStore";
import { useRuleStore } from "@/stores/ruleStore";
import { FolderItem } from "@/components/folders/FolderItem";
import type { Folder } from "@/types";
import { cn } from "@/lib/utils";

interface TreeNode {
  folder: Folder;
  children: TreeNode[];
}

function buildTree(folders: Folder[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  folders.forEach((f) => {
    map.set(f.id, { folder: f, children: [] });
  });

  // Assemble tree
  folders.forEach((f) => {
    const node = map.get(f.id)!;
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort: Groups first, then by name
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.folder.isGroup !== b.folder.isGroup) {
        return a.folder.isGroup ? -1 : 1;
      }
      return a.folder.name.localeCompare(b.folder.name);
    });
    nodes.forEach(n => sortNodes(n.children));
  };

  sortNodes(roots);
  return roots;
}

export function FolderList() {
  const folders = useFolderStore((state) => state.folders);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const selectFolder = useFolderStore((state) => state.selectFolder);
  const toggleFolder = useFolderStore((state) => state.toggleFolder);
  const moveFolder = useFolderStore((state) => state.moveFolder);
  const rules = useRuleStore((state) => state.rules);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem("filedispatch.folderGroups");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(folders), [folders]);

  useEffect(() => {
    try {
      window.localStorage.setItem("filedispatch.folderGroups", JSON.stringify(expandedGroups));
    } catch {
      return;
    }
  }, [expandedGroups]);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId?: string, isGroup?: boolean) => {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation to root

    if (!draggedId || draggedId === targetId) return;

    // Check if dragging parent into child (cycle detection)
    // Simple check: we rely on flat list scan or just let backend fail/handle it?
    // Let's rely on basic logic: We can't easily check recursion here without traversing up.
    // For now, allow it visually, backend/store should probably validate.

    if (isGroup) {
      setDropTargetId(targetId || null);
    } else {
      // If hovering over a file, maybe target is its parent? 
      // For simplicity, only allow dropping ON groups or ON root (empty space).
      // If dropping on a file, we could interpret as "sibling", taking its parent.
      // But let's stick to: Drop on Group -> Nest. Drop on Root -> Unnest.
      setDropTargetId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    const id = draggedId;
    setDraggedId(null);
    setDropTargetId(null);

    if (!id || id === targetId) return;

    await moveFolder(id, targetId);
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedGroups[node.folder.id];
    const isDragOver = dropTargetId === node.folder.id;

    return (
      <div key={node.folder.id} className="relative">
        <div
          className={cn(
            "relative flex items-center transition-colors rounded",
            isDragOver && "bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]"
          )}
          style={{ paddingLeft: `${depth * 12}px` }}
          draggable
          onDragStart={(e) => handleDragStart(e, node.folder.id)}
          onDragOver={(e) => handleDragOver(e, node.folder.id, node.folder.isGroup)}
          onDrop={(e) => handleDrop(e, node.folder.id)}
        >
          {/* Expand/Collapse Arrow */}
          <button
            type="button"
            className="w-4 h-4 flex items-center justify-center cursor-pointer shrink-0 opacity-50 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              if (node.folder.isGroup) toggleGroup(node.folder.id);
            }}
            aria-label={isExpanded ? "Collapse group" : "Expand group"}
            disabled={!node.folder.isGroup}
          >
            {node.folder.isGroup && (
              <ChevronRight className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-90")} />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <FolderItem
              folder={node.folder}
              selected={node.folder.id === selectedFolderId}
              ruleCount={node.folder.ruleCount ?? (node.folder.id === selectedFolderId ? rules.length : 0)}
              onSelect={() => selectFolder(node.folder.id)}
              onToggle={(enabled) => toggleFolder(node.folder.id, enabled)}
            />
          </div>
        </div>

        {/* Children */}
        {node.folder.isGroup && isExpanded && (
          <div className="flex flex-col gap-0.5">
            {node.children.map(child => renderNode(child, depth + 1))}
            {node.children.length === 0 && (
              <div className="pl-6 py-1 text-[10px] text-[var(--fg-muted)] italic">
                Empty group
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-1 overflow-y-auto custom-scrollbar p-2"
        onDragOver={(e) => {
          e.preventDefault();
          setDropTargetId(null); // Clear drop target implies Dropping on Root
        }}
        onDrop={(e) => handleDrop(e, undefined)} // Root drop
      >
        <div className="flex flex-col gap-1 min-h-[50px]">
          {/* List */}
          <div className="flex flex-col gap-0.5" >
            {folders.length === 0 ? (
              <div className="mx-2 mt-1 rounded-[var(--radius)] border border-dashed border-[var(--border-main)] px-4 py-6 text-center text-xs text-[var(--fg-muted)]">
                No folders yet.
              </div>
            ) : (
              tree.map(node => renderNode(node))
            )}

            {/* Drop Zone hint for Root */}
            {draggedId && !dropTargetId && (
              <div className="mt-2 h-8 rounded border border-dashed border-[var(--accent)] bg-[var(--accent-muted)]/20 flex items-center justify-center text-[10px] text-[var(--accent)]">
                Move to top level
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
