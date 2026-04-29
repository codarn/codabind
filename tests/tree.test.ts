import { describe, expect, it } from "vitest";
import { buildTree, fqdn, findNode, recordsInSubtree } from "../src/zone/tree";
import type { ZoneRecord } from "../src/zone/types";

const r = (name: string, type: ZoneRecord["record"]["type"] = "A"): ZoneRecord => ({
  id: name + "-" + type,
  name,
  ttl: "",
  class: "IN",
  record: type === "A"
    ? { type: "A", data: { address: "192.0.2.1" } }
    : { type: "CNAME", data: { target: "x.example.com." } },
});

describe("fqdn", () => {
  it("uses owner verbatim when fully qualified", () => {
    expect(fqdn(r("www.example.com."), "anything")).toBe("www.example.com.");
  });
  it("returns origin for @ or empty owner", () => {
    expect(fqdn(r("@"), "example.com.")).toBe("example.com.");
    expect(fqdn(r(""), "example.com.")).toBe("example.com.");
  });
  it("appends origin when owner is relative", () => {
    expect(fqdn(r("www"), "example.com.")).toBe("www.example.com.");
    expect(fqdn(r("www"), "example.com")).toBe("www.example.com.");
  });
});

describe("buildTree", () => {
  it("groups records by FQDN labels TLD-first", () => {
    const records = [r("www"), r("api"), r("@")];
    const root = buildTree(records, "example.com.");
    expect(root.totalCount).toBe(3);
    const com = root.children[0];
    expect(com?.label).toBe("com");
    const example = com?.children[0];
    expect(example?.label).toBe("example");
    expect(example?.selfRecords).toHaveLength(1);
    expect(example?.children.map((c) => c.label).sort()).toEqual(["api", "www"]);
  });
});

describe("findNode + recordsInSubtree", () => {
  it("returns all records under a path", () => {
    const records = [r("www"), r("api"), r("@"), r("a.b")];
    const root = buildTree(records, "example.com.");
    const example = findNode(root, ["com", "example"]);
    expect(example).not.toBeNull();
    if (example) expect(recordsInSubtree(example)).toHaveLength(4);
  });

  it("returns null for nonexistent path", () => {
    const root = buildTree([r("www")], "example.com.");
    expect(findNode(root, ["nope"])).toBeNull();
  });
});
