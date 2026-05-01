import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importFromDns } from "../src/dns/import";

interface DohResponseShape {
  Status: number;
  Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
}

function dohJson(answers: DohResponseShape["Answer"]): DohResponseShape {
  return { Status: 0, Answer: answers ?? [] };
}

function nx(): DohResponseShape {
  return { Status: 3, Answer: [] };
}

function mockFetch(routes: Map<string, DohResponseShape>) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = new URL(typeof url === "string" ? url : url.toString());
    const name = u.searchParams.get("name") ?? "";
    const type = u.searchParams.get("type") ?? "";
    const key = `${name.toLowerCase()}|${type.toUpperCase()}`;
    const body = routes.get(key) ?? nx();
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/dns-json" },
    });
  });
}

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
  vi.restoreAllMocks();
});

describe("importFromDns — apex records", () => {
  beforeEach(() => {
    const routes = new Map<string, DohResponseShape>([
      ["example.com.|SOA", dohJson([
        { name: "example.com.", type: 6, TTL: 300, data: "ns1.example.com. admin.example.com. 2026010101 3600 1800 1209600 3600" },
      ])],
      ["example.com.|NS", dohJson([
        { name: "example.com.", type: 2, TTL: 3600, data: "ns1.example.com." },
        { name: "example.com.", type: 2, TTL: 3600, data: "ns2.example.com." },
      ])],
      ["example.com.|A", dohJson([
        { name: "example.com.", type: 1, TTL: 300, data: "192.0.2.1" },
      ])],
      ["example.com.|MX", dohJson([
        { name: "example.com.", type: 15, TTL: 3600, data: "10 mail.example.com." },
      ])],
      ["example.com.|TXT", dohJson([
        { name: "example.com.", type: 16, TTL: 300, data: '"v=spf1 -all"' },
      ])],
    ]);
    globalThis.fetch = mockFetch(routes) as unknown as typeof fetch;
  });

  it("returns a zone with origin and SOA-derived TTL", async () => {
    const { zone, errors } = await importFromDns("cloudflare", "example.com");
    expect(errors).toEqual([]);
    expect(zone.origin).toBe("example.com.");
    expect(zone.ttl).toBe("300");
    expect(zone.records.length).toBeGreaterThan(0);
  });

  it("populates each apex RR type in the zone", async () => {
    const { zone } = await importFromDns("cloudflare", "example.com");
    const types = new Set(zone.records.map((r) => r.record.type));
    expect(types.has("SOA")).toBe(true);
    expect(types.has("NS")).toBe(true);
    expect(types.has("A")).toBe(true);
    expect(types.has("MX")).toBe(true);
    expect(types.has("TXT")).toBe(true);
  });

  it("splits MX answer into priority and target", async () => {
    const { zone } = await importFromDns("cloudflare", "example.com");
    const mx = zone.records.find((r) => r.record.type === "MX");
    if (mx?.record.type === "MX") {
      expect(mx.record.data.priority).toBe("10");
      expect(mx.record.data.target).toBe("mail.example.com.");
    }
  });

  it("strips outer quotes from TXT data", async () => {
    const { zone } = await importFromDns("cloudflare", "example.com");
    const txt = zone.records.find((r) => r.record.type === "TXT");
    if (txt?.record.type === "TXT") {
      expect(txt.record.data.text).toBe("v=spf1 -all");
    }
  });

  it("expands SOA into structured fields", async () => {
    const { zone } = await importFromDns("cloudflare", "example.com");
    const soa = zone.records.find((r) => r.record.type === "SOA");
    if (soa?.record.type === "SOA") {
      expect(soa.record.data.mname).toBe("ns1.example.com.");
      expect(soa.record.data.rname).toBe("admin.example.com.");
      expect(soa.record.data.serial).toBe("2026010101");
    }
  });

  it("trims and normalizes the input domain", async () => {
    const { zone } = await importFromDns("cloudflare", "  Example.com.  ");
    expect(zone.origin).toBe("example.com.");
  });
});

describe("importFromDns — error paths", () => {
  it("rejects unknown resolver", async () => {
    const { errors } = await importFromDns("nonexistent", "example.com");
    expect(errors[0]).toMatch(/unknown resolver/i);
  });

  it("rejects empty domain", async () => {
    const { errors } = await importFromDns("cloudflare", "  .  ");
    expect(errors[0]).toMatch(/required/i);
  });

  it("collects per-type errors when fetch throws", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const { errors, zone } = await importFromDns("cloudflare", "example.com");
    expect(errors.length).toBeGreaterThan(0);
    expect(zone.records).toHaveLength(0);
  });
});
