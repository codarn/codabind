import { describe, expect, it } from "vitest";
import {
  isIPv4,
  isIPv6,
  isHostname,
  isName,
  parseDuration,
  validateZone,
} from "../src/zone/validator";
import type { Zone, ZoneRecord } from "../src/zone/types";

const rec = (over: Partial<ZoneRecord> & { record: ZoneRecord["record"] }): ZoneRecord => ({
  id: crypto.randomUUID(),
  name: "@",
  ttl: "",
  class: "IN",
  ...over,
});

describe("isIPv4", () => {
  it("accepts canonical addresses", () => {
    expect(isIPv4("0.0.0.0")).toBe(true);
    expect(isIPv4("192.0.2.1")).toBe(true);
    expect(isIPv4("255.255.255.255")).toBe(true);
  });
  it("rejects out-of-range octets", () => {
    expect(isIPv4("256.0.0.0")).toBe(false);
    expect(isIPv4("1.2.3.999")).toBe(false);
  });
  it("rejects leading zeros and bad shapes", () => {
    expect(isIPv4("01.2.3.4")).toBe(false);
    expect(isIPv4("1.2.3")).toBe(false);
    expect(isIPv4("1.2.3.4.5")).toBe(false);
    expect(isIPv4("")).toBe(false);
  });
});

describe("isIPv6", () => {
  it("accepts full and compressed forms", () => {
    expect(isIPv6("2001:db8:0:0:0:0:0:1")).toBe(true);
    expect(isIPv6("2001:db8::1")).toBe(true);
    expect(isIPv6("::1")).toBe(true);
    expect(isIPv6("::")).toBe(true);
  });
  it("rejects multiple :: and overflow", () => {
    expect(isIPv6("2001::db8::1")).toBe(false);
    expect(isIPv6("1:2:3:4:5:6:7:8:9")).toBe(false);
    expect(isIPv6("zzzz::1")).toBe(false);
    expect(isIPv6("1:2:3:4:5:6:7")).toBe(false);
  });
});

describe("isHostname / isName", () => {
  it("accepts FQDNs and relative names", () => {
    expect(isHostname("example.com.")).toBe(true);
    expect(isHostname("ns1.example.com")).toBe(true);
    expect(isHostname("@")).toBe(true);
    expect(isHostname("*.example.com.")).toBe(true);
    expect(isHostname("_dmarc.example.com.")).toBe(true);
  });
  it("rejects invalid characters", () => {
    expect(isHostname("")).toBe(false);
    expect(isHostname("-bad.example.com")).toBe(false);
    expect(isHostname("bad-.example.com")).toBe(false);
  });
  it("isName allows wildcards in labels", () => {
    expect(isName("*")).toBe(true);
    expect(isName("@")).toBe(true);
    expect(isName("www")).toBe(true);
    expect(isName("")).toBe(false);
  });
});

describe("parseDuration", () => {
  it("treats bare digits as seconds", () => {
    expect(parseDuration("0")).toBe(0);
    expect(parseDuration("3600")).toBe(3600);
  });
  it("expands BIND units", () => {
    expect(parseDuration("1s")).toBe(1);
    expect(parseDuration("1m")).toBe(60);
    expect(parseDuration("1h")).toBe(3600);
    expect(parseDuration("1d")).toBe(86400);
    expect(parseDuration("1w")).toBe(604800);
    expect(parseDuration("1h30m")).toBe(3600 + 1800);
    expect(parseDuration("3H")).toBe(3 * 3600);
  });
  it("rejects garbage", () => {
    expect(parseDuration("")).toBe(null);
    expect(parseDuration("abc")).toBe(null);
    expect(parseDuration("1x")).toBe(null);
    expect(parseDuration("h")).toBe(null);
  });
});

describe("validateZone — CNAME coexistence", () => {
  const zone = (records: ZoneRecord[], origin = "example.com."): Zone => ({
    origin,
    ttl: "3600",
    records,
  });

  it("flags CNAME + A on same FQDN even when written as relative + absolute", () => {
    const z = zone([
      rec({ name: "www", record: { type: "CNAME", data: { target: "host.example.com." } } }),
      rec({ name: "www.example.com.", record: { type: "A", data: { address: "192.0.2.1" } } }),
    ]);
    const issues = validateZone(z);
    expect(issues.some((i) => i.message.includes("CNAME must not coexist"))).toBe(true);
  });

  it("allows CNAME alone", () => {
    const z = zone([
      rec({ name: "www", record: { type: "CNAME", data: { target: "host.example.com." } } }),
    ]);
    const issues = validateZone(z).filter((i) => i.message.includes("CNAME must not coexist"));
    expect(issues).toHaveLength(0);
  });
});

describe("validateRecord — per type rules", () => {
  const z = (record: ZoneRecord): Zone => ({
    origin: "example.com.",
    ttl: "3600",
    records: [
      rec({ name: "@", record: { type: "SOA", data: { mname: "ns1.example.com.", rname: "admin.example.com.", serial: "1", refresh: "1h", retry: "30m", expire: "1w", minimum: "1h" } } }),
      rec({ name: "@", record: { type: "NS", data: { target: "ns1.example.com." } } }),
      record,
    ],
  });
  const errs = (zone: Zone) => validateZone(zone).filter((i) => i.severity === "error");

  it("A: rejects bad IPv4", () => {
    expect(errs(z(rec({ name: "x", record: { type: "A", data: { address: "999.0.0.1" } } })))).toHaveLength(1);
  });
  it("AAAA: rejects bad IPv6", () => {
    expect(errs(z(rec({ name: "x", record: { type: "AAAA", data: { address: "zzzz" } } })))).toHaveLength(1);
  });
  it("MX: priority and target", () => {
    expect(errs(z(rec({ name: "x", record: { type: "MX", data: { priority: "70000", target: "-bad" } } })))).toHaveLength(2);
  });
  it("SRV: rejects out-of-range fields", () => {
    expect(errs(z(rec({ name: "x", record: { type: "SRV", data: { priority: "70000", weight: "x", port: "y", target: "" } } })))).toHaveLength(4);
  });
  it("CAA: flags + tag + value", () => {
    const issues = validateZone(z(rec({ name: "x", record: { type: "CAA", data: { flags: "300", tag: "wrong", value: "" } } })));
    expect(issues.some((i) => i.field === "flags" && i.severity === "error")).toBe(true);
    expect(issues.some((i) => i.field === "tag" && i.severity === "warning")).toBe(true);
    expect(issues.some((i) => i.field === "value" && i.severity === "error")).toBe(true);
  });
  it("TXT: empty rejected", () => {
    expect(errs(z(rec({ name: "x", record: { type: "TXT", data: { text: "" } } })))).toHaveLength(1);
  });
  it("origin must be FQDN-shaped or warns", () => {
    const issues = validateZone({ origin: "example", ttl: "3600", records: [] });
    expect(issues.some((i) => i.field === "origin" && i.severity === "warning")).toBe(true);
  });
  it("zone TTL must be valid", () => {
    const issues = validateZone({ origin: "example.com.", ttl: "not-a-duration", records: [] });
    expect(issues.some((i) => i.field === "ttl" && i.severity === "error")).toBe(true);
  });
  it("warns when no NS records", () => {
    const issues = validateZone({ origin: "example.com.", ttl: "3600", records: [] });
    expect(issues.some((i) => i.message === "Zone has no NS records.")).toBe(true);
  });
});

describe("validateZone — SOA presence", () => {
  it("warns when SOA missing", () => {
    const z: Zone = { origin: "example.com.", ttl: "3600", records: [] };
    const issues = validateZone(z);
    expect(issues.some((i) => i.message === "Zone is missing an SOA record.")).toBe(true);
  });
  it("errors when more than one SOA", () => {
    const soa: ZoneRecord["record"] = {
      type: "SOA",
      data: { mname: "ns1.example.com.", rname: "admin.example.com.", serial: "1", refresh: "1h", retry: "1h", expire: "1w", minimum: "1h" },
    };
    const z: Zone = {
      origin: "example.com.",
      ttl: "3600",
      records: [rec({ record: soa }), rec({ record: soa })],
    };
    const issues = validateZone(z);
    expect(issues.some((i) => i.message === "Zone has more than one SOA record.")).toBe(true);
  });
});
