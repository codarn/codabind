import type { ZoneRecord } from "./types";

export function fqdn(record: ZoneRecord, origin: string): string {
  const o = origin.endsWith(".") ? origin : origin ? origin + "." : "";
  const name = record.name;
  if (!name || name === "@") return o;
  if (name.endsWith(".")) return name;
  return o ? `${name}.${o}` : `${name}.`;
}

function labelsOf(fq: string): string[] {
  const trimmed = fq.replace(/\.$/, "");
  if (!trimmed) return [];
  return trimmed.split(".").reverse();
}

export function compareFqdnsByLabels(a: string, b: string): number {
  const al = labelsOf(a);
  const bl = labelsOf(b);
  const len = Math.min(al.length, bl.length);
  for (let i = 0; i < len; i++) {
    const cmp = al[i]!.localeCompare(bl[i]!);
    if (cmp !== 0) return cmp;
  }
  return al.length - bl.length;
}

export interface TreeNode {
  label: string;
  path: string[];
  fqdn: string;
  children: TreeNode[];
  selfRecords: ZoneRecord[];
  totalCount: number;
}

export function buildTree(records: ZoneRecord[], origin: string): TreeNode {
  const root: TreeNode = {
    label: "(root)",
    path: [],
    fqdn: ".",
    children: [],
    selfRecords: [],
    totalCount: 0,
  };

  for (const r of records) {
    const labels = labelsOf(fqdn(r, origin));
    let node = root;
    const pathSoFar: string[] = [];
    for (const lbl of labels) {
      pathSoFar.push(lbl);
      let child = node.children.find((c) => c.label === lbl);
      if (!child) {
        child = {
          label: lbl,
          path: [...pathSoFar],
          fqdn: pathSoFar.slice().reverse().join(".") + ".",
          children: [],
          selfRecords: [],
          totalCount: 0,
        };
        node.children.push(child);
      }
      node = child;
    }
    node.selfRecords.push(r);
  }

  const computeCounts = (n: TreeNode): number => {
    let total = n.selfRecords.length;
    for (const c of n.children) total += computeCounts(c);
    n.totalCount = total;
    return total;
  };
  computeCounts(root);

  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => a.label.localeCompare(b.label));
    for (const c of n.children) sortRec(c);
  };
  sortRec(root);

  return root;
}

export function findNode(root: TreeNode, path: string[]): TreeNode | null {
  let node: TreeNode | null = root;
  for (const lbl of path) {
    if (!node) return null;
    node = node.children.find((c) => c.label === lbl) ?? null;
  }
  return node;
}

export function recordsInSubtree(node: TreeNode): ZoneRecord[] {
  const out: ZoneRecord[] = [...node.selfRecords];
  for (const c of node.children) out.push(...recordsInSubtree(c));
  return out;
}
