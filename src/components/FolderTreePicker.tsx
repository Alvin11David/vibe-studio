import { useMemo, useState } from "react";
import { ChevronRight, Folder, FolderOpen, FolderPlus, Check, X } from "lucide-react";

type Node = {
  name: string;
  path: string; // "" for root
  children: Map<string, Node>;
};

function buildTree(paths: string[]): Node {
  const root: Node = { name: "(root)", path: "", children: new Map() };
  for (const p of paths) {
    const idx = p.lastIndexOf("/");
    if (idx === -1) continue;
    const dir = p.slice(0, idx);
    let node = root;
    let acc = "";
    for (const seg of dir.split("/")) {
      acc = acc ? `${acc}/${seg}` : seg;
      if (!node.children.has(seg)) {
        node.children.set(seg, { name: seg, path: acc, children: new Map() });
      }
      node = node.children.get(seg)!;
    }
  }
  return root;
}

function sanitizeSegment(s: string): string | null {
  const t = s.trim();
  if (!t || t === "." || t === "..") return null;
  if (!/^[A-Za-z0-9._-]+$/.test(t)) return null;
  return t;
}
function sanitizePath(raw: string): string | null {
  const cleaned = raw.trim().replace(/^\.?\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/");
  if (!cleaned) return null;
  const segs = cleaned.split("/");
  const out: string[] = [];
  for (const s of segs) {
    const v = sanitizeSegment(s);
    if (!v) return null;
    out.push(v);
  }
  return out.join("/");
}

export function FolderTreePicker({
  filePaths,
  selected,
  onSelect,
  onClose,
}: {
  filePaths: string[];
  selected: string;
  onSelect: (folder: string) => void;
  onClose: () => void;
}) {
  const tree = useMemo(() => buildTree(filePaths), [filePaths]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>([""]);
    // expand path to currently-selected folder
    if (selected) {
      const parts = selected.split("/");
      let acc = "";
      for (const p of parts) {
        acc = acc ? `${acc}/${p}` : p;
        s.add(acc);
      }
    }
    return s;
  });
  const [creatingUnder, setCreatingUnder] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  // virtual folders created in-session (not yet containing files)
  const [virtualFolders, setVirtualFolders] = useState<Set<string>>(new Set());

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const startCreate = (parent: string) => {
    setCreatingUnder(parent);
    setNewName("");
    setError("");
    setExpanded((prev) => new Set(prev).add(parent));
  };

  const commitCreate = () => {
    if (creatingUnder === null) return;
    const sub = sanitizePath(newName);
    if (!sub) {
      setError("Use letters, numbers, . _ - and / only");
      return;
    }
    const full = creatingUnder ? `${creatingUnder}/${sub}` : sub;
    setVirtualFolders((prev) => new Set(prev).add(full));
    // expand each ancestor of the new folder
    setExpanded((prev) => {
      const next = new Set(prev);
      let acc = "";
      for (const p of full.split("/")) {
        acc = acc ? `${acc}/${p}` : p;
        next.add(acc);
      }
      return next;
    });
    setCreatingUnder(null);
    setNewName("");
    onSelect(full);
  };

  // merge virtual folders into the tree for display
  const mergedTree = useMemo(() => {
    const t = buildTree([
      ...filePaths,
      // add a fake file under each virtual folder so buildTree creates the dir
      ...Array.from(virtualFolders).map((f) => `${f}/.keep`),
    ]);
    return t;
  }, [filePaths, virtualFolders]);

  const renderNode = (node: Node, depth: number) => {
    const isOpen = expanded.has(node.path);
    const isSelected = selected === node.path;
    const hasChildren = node.children.size > 0;
    return (
      <div key={node.path || "__root__"}>
        <div
          className={`group flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-gold/5 ${
            isSelected ? "bg-gold/10 text-gold" : "text-gold-soft"
          }`}
          style={{ paddingLeft: 6 + depth * 12 }}
        >
          <button
            type="button"
            onClick={() => toggle(node.path)}
            className={`flex h-4 w-4 items-center justify-center text-muted-foreground ${hasChildren ? "" : "invisible"}`}
            aria-label="Toggle"
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => onSelect(node.path)}
            className="flex flex-1 items-center gap-1.5 text-left"
          >
            {isOpen && hasChildren ? (
              <FolderOpen className="h-3.5 w-3.5 text-gold/70" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-gold/70" />
            )}
            <span className="truncate font-mono">{node.name}</span>
            {isSelected && <Check className="ml-auto h-3 w-3 text-gold" />}
          </button>
          <button
            type="button"
            onClick={() => startCreate(node.path)}
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:bg-gold/10 hover:text-gold"
            title="New folder inside"
          >
            <FolderPlus className="h-3 w-3" />
          </button>
        </div>
        {isOpen && creatingUnder === node.path && (
          <div className="flex items-center gap-1 px-1.5 py-1" style={{ paddingLeft: 6 + (depth + 1) * 12 }}>
            <Folder className="h-3.5 w-3.5 text-gold/40" />
            <input
              autoFocus
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCreate();
                else if (e.key === "Escape") setCreatingUnder(null);
              }}
              placeholder="folder or nested/path"
              className="flex-1 rounded border border-gold/30 bg-onyx px-1.5 py-0.5 text-xs text-gold-soft outline-none focus:border-gold/60"
            />
            <button onClick={commitCreate} className="rounded p-0.5 text-gold hover:bg-gold/10" title="Create">
              <Check className="h-3 w-3" />
            </button>
            <button onClick={() => setCreatingUnder(null)} className="rounded p-0.5 text-muted-foreground hover:bg-gold/10" title="Cancel">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {isOpen && creatingUnder === node.path && error && (
          <div className="px-2 text-[10px] text-red-300" style={{ paddingLeft: 6 + (depth + 1) * 12 }}>{error}</div>
        )}
        {isOpen && (
          <div>
            {Array.from(node.children.values())
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-gold/20 bg-onyx/95 p-2 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>Choose folder</span>
        <button onClick={onClose} className="rounded p-0.5 hover:bg-gold/10 hover:text-gold">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="max-h-72 overflow-auto">{renderNode(mergedTree, 0)}</div>
      <div className="mt-1.5 flex items-center justify-between border-t border-gold/10 px-1 pt-1.5 text-[10px] text-muted-foreground">
        <span className="truncate font-mono">
          Selected: <span className="text-gold-soft">{selected || "(root)"}/</span>
        </span>
        <button
          onClick={onClose}
          className="rounded border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] text-gold hover:bg-gold/20"
        >
          Done
        </button>
      </div>
    </div>
  );
}
