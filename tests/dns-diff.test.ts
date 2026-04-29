import { describe, expect, it } from "vitest";
import {
  expectedValuesFor,
  liveValueFor,
  statusFor,
  TYPE_TO_IANA,
} from "../src/dns/diff";
import type { ResolverResponse } from "../src/dns/types";
import type { ZoneRecord } from "../src/zone/types";

const a = (name: string, address: string): ZoneRecord => ({
  id: crypto.randomUUID(),
  name,
  ttl: "",
  class: "IN",
  record: { type: "A", data: { address } },
});

const ok = (data: string, type: number): ResolverResponse => ({
  status: "ok",
  latencyMs: 10,
  answers: [{ name: "x", type, TTL: 60, data }],
});

const nxdomain = (): ResolverResponse => ({ status: "nxdomain", latencyMs: 10, answers: [] });
const errored = (): ResolverResponse => ({ status: "error", latencyMs: 10, answers: [], errorMessage: "boom" });

describe("expectedValuesFor", () => {
  it("normalizes A address to lowercase", () => {
    expect(expectedValuesFor(a("@", "192.0.2.1"))).toEqual(["192.0.2.1"]);
  });

  it("strips trailing dot from CNAME target", () => {
    const r: ZoneRecord = {
      id: "1", name: "www", ttl: "", class: "IN",
      record: { type: "CNAME", data: { target: "host.example.com." } },
    };
    expect(expectedValuesFor(r)).toEqual(["host.example.com"]);
  });

  it("formats MX as priority + normalized target", () => {
    const r: ZoneRecord = {
      id: "1", name: "@", ttl: "", class: "IN",
      record: { type: "MX", data: { priority: "10", target: "Mail.Example.Com." } },
    };
    expect(expectedValuesFor(r)).toEqual(["10 mail.example.com"]);
  });

  it("unwraps quoted TXT", () => {
    const r: ZoneRecord = {
      id: "1", name: "@", ttl: "", class: "IN",
      record: { type: "TXT", data: { text: '"v=spf1 -all"' } },
    };
    expect(expectedValuesFor(r)).toEqual(["v=spf1 -all"]);
  });
});

describe("liveValueFor", () => {
  it("normalizes MX priority + target", () => {
    const rec: ZoneRecord = {
      id: "1", name: "@", ttl: "", class: "IN",
      record: { type: "MX", data: { priority: "10", target: "mail.example.com." } },
    };
    const ans = { name: "example.com.", type: 15, TTL: 300, data: "10 Mail.Example.com." };
    expect(liveValueFor(rec, ans)).toBe("10 mail.example.com");
  });

  it("returns serial for SOA", () => {
    const rec: ZoneRecord = {
      id: "1", name: "@", ttl: "", class: "IN",
      record: { type: "SOA", data: { mname: "ns", rname: "admin", serial: "2026010101", refresh: "1h", retry: "1h", expire: "1w", minimum: "1h" } },
    };
    const ans = { name: "example.com.", type: 6, TTL: 300, data: "ns admin 2026010101 3600 3600 604800 3600" };
    expect(liveValueFor(rec, ans)).toBe("2026010101");
  });
});

describe("statusFor", () => {
  const rec = a("@", "192.0.2.1");
  const T = TYPE_TO_IANA.A;

  it("match when all resolvers return the editor's value", () => {
    const m = new Map<string, ResolverResponse>([
      ["a", ok("192.0.2.1", T)],
      ["b", ok("192.0.2.1", T)],
    ]);
    expect(statusFor(rec, m)).toBe("match");
  });

  it("propagating when some resolvers still return the old value", () => {
    const m = new Map<string, ResolverResponse>([
      ["a", ok("192.0.2.1", T)],
      ["b", ok("198.51.100.5", T)],
    ]);
    expect(statusFor(rec, m)).toBe("propagating");
  });

  it("mismatch when no resolver returns the editor's value", () => {
    const m = new Map<string, ResolverResponse>([
      ["a", ok("198.51.100.5", T)],
      ["b", ok("198.51.100.5", T)],
    ]);
    expect(statusFor(rec, m)).toBe("mismatch");
  });

  it("missing when all resolvers return NXDOMAIN", () => {
    const m = new Map<string, ResolverResponse>([
      ["a", nxdomain()],
      ["b", nxdomain()],
    ]);
    expect(statusFor(rec, m)).toBe("missing");
  });

  it("error when all resolvers errored", () => {
    const m = new Map<string, ResolverResponse>([
      ["a", errored()],
      ["b", errored()],
    ]);
    expect(statusFor(rec, m)).toBe("error");
  });

  it("propagating when some resolvers have no answer and some match", () => {
    const m = new Map<string, ResolverResponse>([
      ["a", ok("192.0.2.1", T)],
      ["b", nxdomain()],
    ]);
    expect(statusFor(rec, m)).toBe("propagating");
  });

  it("ignores answers of a different RR type", () => {
    const m = new Map<string, ResolverResponse>([
      ["a", ok("ns1.example.com.", TYPE_TO_IANA.NS)],
    ]);
    expect(statusFor(rec, m)).toBe("missing");
  });
});
