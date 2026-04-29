import { describe, expect, it } from "vitest";
import {
  countByType,
  filterByType,
  groupByFqdn,
  pathToFqdn,
  recordsInScope,
  relativeNameForPath,
} from "../src/zone/selectors";
import { buildTree } from "../src/zone/tree";
import type { Zone, ZoneRecord } from "../src/zone/types";

const a = (name: string): ZoneRecord => ({
  id: crypto.randomUUID(),
  name,
  ttl: "",
  class: "IN",
  record: { type: "A", data: { address: "192.0.2.1" } },
});

const ns = (name: string): ZoneRecord => ({
  id: crypto.randomUUID(),
  name,
  ttl: "",
  class: "IN",
  record: { type: "NS", data: { target: "ns1.example.com." } },
});

const zone = (records: ZoneRecord[]): Zone => ({
  origin: "example.com.",
  ttl: "3600",
  records,
});

describe("recordsInScope", () => {
  it("returns all records when no path is selected", () => {
    const z = zone([a("www"), a("api")]);
    const tree = buildTree(z.records, z.origin);
    expect(recordsInScope(z, tree, [])).toHaveLength(2);
  });

  it("returns records under the selected subtree", () => {
    const z = zone([a("www"), a("api"), a("@")]);
    const tree = buildTree(z.records, z.origin);
    const scoped = recordsInScope(z, tree, ["com", "example", "www"]);
    expect(scoped.map((r) => r.name)).toEqual(["www"]);
  });

  it("returns empty array for an unknown path", () => {
    const z = zone([a("www")]);
    const tree = buildTree(z.records, z.origin);
    expect(recordsInScope(z, tree, ["nope"])).toEqual([]);
  });
});

describe("filterByType / countByType", () => {
  it("filters by type", () => {
    const records = [a("www"), ns("@"), a("api")];
    expect(filterByType(records, "A")).toHaveLength(2);
    expect(filterByType(records, "NS")).toHaveLength(1);
    expect(filterByType(records, "ALL")).toHaveLength(3);
  });

  it("counts by type", () => {
    const counts = countByType([a("www"), a("api"), ns("@")]);
    expect(counts.get("A")).toBe(2);
    expect(counts.get("NS")).toBe(1);
    expect(counts.get("MX")).toBeUndefined();
  });
});

describe("groupByFqdn", () => {
  it("groups records by fqdn and orders TLD-first by labels", () => {
    const records = [a("www"), a("api"), a("@")];
    const groups = groupByFqdn(records, "example.com.");
    const fqdns = groups.map(([k]) => k);
    expect(fqdns).toEqual(["example.com.", "api.example.com.", "www.example.com."]);
  });
});

describe("pathToFqdn", () => {
  it('returns "all domains" for empty path', () => {
    expect(pathToFqdn([])).toBe("all domains");
  });
  it("reverses TLD-first labels into a trailing-dot fqdn", () => {
    expect(pathToFqdn(["com", "example", "www"])).toBe("www.example.com.");
  });
});

describe("relativeNameForPath", () => {
  it("returns sub-name when path is inside origin", () => {
    expect(relativeNameForPath("example.com.", ["com", "example", "www"])).toBe("www");
    expect(relativeNameForPath("example.com.", ["com", "example", "a", "b"])).toBe("b.a");
  });
  it('returns "@" when path equals origin', () => {
    expect(relativeNameForPath("example.com.", ["com", "example"])).toBe("@");
  });
  it("returns absolute fqdn when path is outside origin", () => {
    expect(relativeNameForPath("example.com.", ["org", "other"])).toBe("other.org.");
  });
});
