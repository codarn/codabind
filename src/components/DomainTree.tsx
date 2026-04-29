import { useState } from "react";
import type { TreeNode } from "../zone/tree";

interface Props {
  root: TreeNode;
  selectedPath: string[];
  onSelect: (path: string[]) => void;
}

export function DomainTree({ root, selectedPath, onSelect }: Props) {
  const isAll = selectedPath.length === 0;
  return (
    <nav className="tree">
      <button
        className={`tree-row tree-all ${isAll ? "selected" : ""}`}
        onClick={() => onSelect([])}
      >
        <span className="tree-label">All domains</span>
        <span className="tree-count">{root.totalCount}</span>
      </button>
      <ul className="tree-list">
        {root.children.map((c) => (
          <TreeBranch
            key={c.label}
            node={c}
            depth={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
            defaultOpen
          />
        ))}
      </ul>
    </nav>
  );
}

function TreeBranch({
  node,
  depth,
  selectedPath,
  onSelect,
  defaultOpen = false,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string[];
  onSelect: (path: string[]) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = node.children.length > 0;
  const isSelected =
    selectedPath.length === node.path.length &&
    selectedPath.every((p, i) => p === node.path[i]);

  return (
    <li>
      <div
        className={`tree-row depth-${Math.min(depth, 9)} ${isSelected ? "selected" : ""}`}
      >
        <button
          className="tree-toggle"
          onClick={() => setOpen((o) => !o)}
          disabled={!hasChildren}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {hasChildren ? (open ? "▾" : "▸") : "·"}
        </button>
        <button className="tree-label-btn" onClick={() => onSelect(node.path)}>
          <span className="tree-label">{node.label}</span>
          <span className="tree-count">{node.totalCount}</span>
        </button>
      </div>
      {hasChildren && open && (
        <ul className="tree-list">
          {node.children.map((c) => (
            <TreeBranch
              key={c.label}
              node={c}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
