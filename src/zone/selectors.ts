import type { RecordType, Zone, ZoneRecord } from "./types";
import {
  compareFqdnsByLabels,
  findNode,
  fqdn,
  recordsInSubtree,
  type TreeNode,
} from "./tree";

export type TypeFilter = "ALL" | RecordType;

export function recordsInScope(
  zone: Zone,
  tree: TreeNode,
  selectedPath: string[],
): ZoneRecord[] {
  if (selectedPath.length === 0) return zone.records;
  const node = findNode(tree, selectedPath);
  return node ? recordsInSubtree(node) : [];
}

export function filterByType(records: ZoneRecord[], filter: TypeFilter): ZoneRecord[] {
  return filter === "ALL" ? records : records.filter((r) => r.record.type === filter);
}

export function countByType(records: ZoneRecord[]): Map<RecordType, number> {
  const counts = new Map<RecordType, number>();
  for (const r of records) {
    counts.set(r.record.type, (counts.get(r.record.type) ?? 0) + 1);
  }
  return counts;
}

export function groupByFqdn(
  records: ZoneRecord[],
  origin: string,
): Array<[string, ZoneRecord[]]> {
  const groups = new Map<string, ZoneRecord[]>();
  for (const r of records) {
    const key = fqdn(r, origin);
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => compareFqdnsByLabels(a, b));
}

export function pathToFqdn(path: string[]): string {
  if (path.length === 0) return "all domains";
  return path.slice().reverse().join(".") + ".";
}

export function relativeNameForPath(origin: string, path: string[]): string {
  const originLabels = origin
    .replace(/\.$/, "")
    .split(".")
    .filter(Boolean)
    .reverse();
  const isInOrigin =
    originLabels.length <= path.length &&
    originLabels.every((label, i) => label === path[i]);
  if (isInOrigin) {
    const sub = path.slice(originLabels.length).slice().reverse().join(".");
    return sub || "@";
  }
  return path.slice().reverse().join(".") + ".";
}
