import { describe, expect, it } from "vitest";
import { parseZone } from "../src/zone/parser";

describe("parseZone — directives", () => {
  it("captures $ORIGIN and $TTL", () => {
    const { zone } = parseZone(`$ORIGIN example.com.\n$TTL 3600\n@  IN  NS  ns1.example.com.\n`);
    expect(zone.origin).toBe("example.com.");
    expect(zone.ttl).toBe("3600");
    expect(zone.records).toHaveLength(1);
  });

  it("flags unknown directives without crashing", () => {
    const { zone, errors } = parseZone(`$WHATEVER foo\n@  IN  NS  ns1.example.com.\n`);
    expect(errors).toContain("Unsupported directive: $WHATEVER foo");
    expect(zone.records).toHaveLength(1);
  });
});

describe("parseZone — owner-name inheritance", () => {
  it("reuses the previous owner when a line starts with whitespace", () => {
    const text = `$ORIGIN example.com.\n` +
      `alias  IN  A  192.0.2.1\n` +
      `       IN  TXT  "v=spf1 -all"\n`;
    const { zone } = parseZone(text);
    expect(zone.records).toHaveLength(2);
    expect(zone.records[0]?.name).toBe("alias");
    expect(zone.records[1]?.name).toBe("alias");
  });
});

describe("parseZone — multi-line SOA via parens", () => {
  it("joins paren'd lines and extracts the timers", () => {
    const text = `$ORIGIN example.com.\n` +
      `@  IN  SOA  ns1.example.com. admin.example.com. (\n` +
      `   2026010101 ; serial\n` +
      `   1h         ; refresh\n` +
      `   30m        ; retry\n` +
      `   1w         ; expire\n` +
      `   1h         ; minimum\n` +
      `)\n`;
    const { zone, errors } = parseZone(text);
    expect(errors).toHaveLength(0);
    expect(zone.records).toHaveLength(1);
    const soa = zone.records[0]?.record;
    expect(soa?.type).toBe("SOA");
    if (soa?.type === "SOA") {
      expect(soa.data.mname).toBe("ns1.example.com.");
      expect(soa.data.rname).toBe("admin.example.com.");
      expect(soa.data.serial).toBe("2026010101");
      expect(soa.data.refresh).toBe("1h");
      expect(soa.data.minimum).toBe("1h");
    }
  });
});

describe("parseZone — comment and quote handling", () => {
  it("ignores ; comments outside quoted strings", () => {
    const { zone } = parseZone(`@  IN  TXT  "v=spf1 -all"  ; this is a comment\n`);
    expect(zone.records).toHaveLength(1);
    const r = zone.records[0]?.record;
    if (r?.type === "TXT") expect(r.data.text).toBe("v=spf1 -all");
  });

  it("keeps ; that lives inside a quoted TXT", () => {
    const { zone } = parseZone(`@  IN  TXT  "k=v; n=2"\n`);
    expect(zone.records).toHaveLength(1);
    const r = zone.records[0]?.record;
    if (r?.type === "TXT") expect(r.data.text).toBe("k=v; n=2");
  });

  it("rescues unquoted TXT records with embedded ; (Loopia/registrar exports)", () => {
    const { zone } = parseZone(`_dmarc IN TXT v=DMARC1; p=none; rua=mailto:foo@example.com\n`);
    expect(zone.records).toHaveLength(1);
    const r = zone.records[0]?.record;
    expect(r?.type).toBe("TXT");
    if (r?.type === "TXT") {
      expect(r.data.text).toBe("v=DMARC1; p=none; rua=mailto:foo@example.com");
    }
  });

  it("handles Loopia's class-then-TTL ordering before TXT", () => {
    const line = `_dmarc                          IN      360     TXT     v=DMARC1; p=none;\n`;
    const { zone } = parseZone(line);
    expect(zone.records).toHaveLength(1);
    const r = zone.records[0];
    expect(r?.ttl).toBe("360");
    expect(r?.class).toBe("IN");
    if (r?.record.type === "TXT") {
      expect(r.record.data.text).toBe("v=DMARC1; p=none;");
    }
  });

  it("wraps and stores opaque-token unquoted TXT (e.g. _pdcid challenge)", () => {
    const line = `_pdcid IN 360 TXT O2XP3XcDj6JMhJPqR2VDZo8ftnMocX7_rsHxRmTrjq7eLcnU\n`;
    const { zone } = parseZone(line);
    const r = zone.records[0];
    if (r?.record.type === "TXT") {
      expect(r.record.data.text).toBe("O2XP3XcDj6JMhJPqR2VDZo8ftnMocX7_rsHxRmTrjq7eLcnU");
    }
  });

  it("strips a real end-of-line comment from an unquoted TXT", () => {
    const { zone } = parseZone(`_dmarc IN TXT v=DMARC1 ; trailing comment\n`);
    expect(zone.records).toHaveLength(1);
    const r = zone.records[0]?.record;
    if (r?.type === "TXT") expect(r.data.text).toBe("v=DMARC1");
  });

  it("preserves multi-string quoted TXT", () => {
    const { zone } = parseZone(`@ IN TXT "v=DKIM1; k=rsa" "p=MIIBIj"\n`);
    expect(zone.records).toHaveLength(1);
    const r = zone.records[0]?.record;
    if (r?.type === "TXT") expect(r.data.text).toBe('"v=DKIM1; k=rsa" "p=MIIBIj"');
  });

  it("handles escaped quotes via odd-length backslash runs", () => {
    const { zone } = parseZone(`@  IN  TXT  "he said \\"hi\\""\n`);
    expect(zone.records).toHaveLength(1);
  });

  it("treats \\\\\\\" as a closed quote (even backslashes do not escape)", () => {
    const { zone } = parseZone(`@  IN  TXT  "abc\\\\" ; comment\n`);
    expect(zone.records).toHaveLength(1);
  });
});

describe("parseZone — record IDs are unique", () => {
  it("crypto.randomUUID gives distinct ids", () => {
    const { zone } = parseZone(`@ IN A 192.0.2.1\n@ IN A 192.0.2.2\n@ IN A 192.0.2.3\n`);
    const ids = zone.records.map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
  });
});
