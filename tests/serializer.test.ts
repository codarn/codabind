import { describe, expect, it } from "vitest";
import { parseZone } from "../src/zone/parser";
import { serializeZone } from "../src/zone/serializer";

describe("serializeZone — round-trip", () => {
  it("preserves a typical zone after parse → serialize → parse", () => {
    const input = `$ORIGIN example.com.\n` +
      `$TTL 3600\n` +
      `@  IN  SOA  ns1.example.com. admin.example.com. (\n` +
      `   2026010101 1h 30m 1w 1h\n` +
      `)\n` +
      `@   IN  NS  ns1.example.com.\n` +
      `www IN  A   192.0.2.1\n` +
      `mx  IN  MX  10 mail.example.com.\n` +
      `_x  IN  TXT "v=spf1 -all"\n`;
    const first = parseZone(input);
    expect(first.errors).toHaveLength(0);
    const second = parseZone(serializeZone(first.zone));
    expect(second.errors).toHaveLength(0);
    expect(second.zone.records).toHaveLength(first.zone.records.length);
    expect(second.zone.origin).toBe(first.zone.origin);
    expect(second.zone.ttl).toBe(first.zone.ttl);
  });
});

describe("serializeZone — TXT encoding", () => {
  const wrapTxt = (text: string) =>
    serializeZone({
      origin: "example.com.",
      ttl: "3600",
      records: [
        {
          id: "1",
          name: "@",
          ttl: "",
          class: "IN",
          record: { type: "TXT", data: { text } },
        },
      ],
    });

  it("wraps unquoted text in quotes", () => {
    const out = wrapTxt("hello world");
    expect(out).toContain('"hello world"');
  });

  it("preserves already-quoted multi-string TXT", () => {
    const out = wrapTxt('"foo" "bar"');
    expect(out).toContain('"foo" "bar"');
  });

  it("escapes backslashes and quotes", () => {
    const out = wrapTxt(`a"b\\c`);
    expect(out).toContain('"a\\"b\\\\c"');
  });

  it("emits empty quoted string for empty TXT", () => {
    const out = wrapTxt("");
    expect(out).toContain('""');
  });

  it("chunks long ASCII strings into <=255 byte segments without dropping bytes", () => {
    const long = "a".repeat(1000);
    const out = wrapTxt(long);
    const txtLine = out.split("\n").find((l) => l.includes('"a'))!;
    const matches = txtLine.match(/"[^"]*"/g) ?? [];
    expect(matches.length).toBeGreaterThan(1);
    const concat = matches.map((m) => m.slice(1, -1)).join("");
    expect(concat).toBe(long);
  });

  it("chunks UTF-8 strings on codepoint boundaries without losing or splitting bytes", () => {
    const cp = "\u{1F600}";
    expect(new TextEncoder().encode(cp).length).toBe(4);
    const long = cp.repeat(100);
    const out = wrapTxt(long);
    const txtLine = out.split("\n").find((l) => l.startsWith("@") || l.includes('"\u{1F600}'))!;
    const matches = txtLine.match(/"[^"]*"/g) ?? [];
    expect(matches.length).toBeGreaterThan(1);
    const concat = matches.map((m) => m.slice(1, -1)).join("");
    expect(concat).toBe(long);
    for (const m of matches) {
      const inner = m.slice(1, -1);
      expect(new TextEncoder().encode(inner).length).toBeLessThanOrEqual(255);
    }
  });
});
