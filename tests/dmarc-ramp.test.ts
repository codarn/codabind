import { describe, expect, it } from "vitest";
import { parseDmarcTags, suggestDmarcStep } from "../src/email/dmarc-ramp";
import type { Zone, ZoneRecord } from "../src/zone/types";

const txt = (name: string, text: string): ZoneRecord => ({
  id: crypto.randomUUID(),
  name,
  ttl: "",
  class: "IN",
  record: { type: "TXT", data: { text } },
});

const zone = (records: ZoneRecord[], origin = "rukkor.com."): Zone => ({
  origin,
  ttl: "3600",
  records,
});

describe("suggestDmarcStep — progression", () => {
  it("suggests monitoring + rua when no DMARC exists", () => {
    const s = suggestDmarcStep(zone([]));
    expect(s).not.toBeNull();
    expect(s!.title).toMatch(/monitoring/i);
    expect(s!.applyTo).toBeNull();
    expect(s!.nextValue).toContain("v=DMARC1");
    expect(s!.nextValue).toContain("p=none");
    expect(s!.nextValue).toContain("rua=mailto:dmarc@rukkor.com");
    expect(s!.nextValue).toContain("fo=1");
  });

  it("suggests adding rua when DMARC exists without it", () => {
    const s = suggestDmarcStep(zone([txt("_dmarc", "v=DMARC1; p=none;")]));
    expect(s!.title).toMatch(/aggregate reporting/i);
    expect(s!.applyTo).not.toBeNull();
    expect(s!.nextValue).toContain("rua=mailto:dmarc@rukkor.com");
  });

  it("suggests quarantine 25% from p=none with rua present", () => {
    const s = suggestDmarcStep(
      zone([txt("_dmarc", "v=DMARC1; p=none; rua=mailto:dmarc@rukkor.com; fo=1;")]),
    );
    expect(s!.title).toMatch(/quarantine \(25/i);
    expect(s!.nextValue).toContain("p=quarantine");
    expect(s!.nextValue).toContain("pct=25");
    expect(s!.nextValue).toContain("rua=mailto:dmarc@rukkor.com");
  });

  it("suggests quarantine 100% from quarantine 25%", () => {
    const s = suggestDmarcStep(
      zone([txt("_dmarc", "v=DMARC1; p=quarantine; pct=25; rua=mailto:x@example.com;")]),
    );
    expect(s!.title).toMatch(/quarantine \(100/i);
    expect(s!.nextValue).toContain("pct=100");
  });

  it("suggests reject from quarantine 100%", () => {
    const s = suggestDmarcStep(
      zone([txt("_dmarc", "v=DMARC1; p=quarantine; pct=100; rua=mailto:x@example.com;")]),
    );
    expect(s!.title).toMatch(/reject/i);
    expect(s!.nextValue).toContain("p=reject");
  });

  it("returns null when already at p=reject", () => {
    expect(
      suggestDmarcStep(
        zone([txt("_dmarc", "v=DMARC1; p=reject; rua=mailto:x@example.com;")]),
      ),
    ).toBeNull();
  });

  it("matches FQDN _dmarc.<origin>", () => {
    const s = suggestDmarcStep(
      zone([txt("_dmarc.rukkor.com.", "v=DMARC1; p=none; rua=mailto:x@example.com;")]),
    );
    expect(s!.title).toMatch(/quarantine/i);
  });
});

describe("parseDmarcTags", () => {
  it("parses a typical record", () => {
    const t = parseDmarcTags("v=DMARC1; p=quarantine; pct=25; rua=mailto:x@example.com;");
    expect(t.get("v")).toBe("DMARC1");
    expect(t.get("p")).toBe("quarantine");
    expect(t.get("pct")).toBe("25");
    expect(t.get("rua")).toBe("mailto:x@example.com");
  });

  it("strips outer quotes", () => {
    const t = parseDmarcTags('"v=DMARC1; p=none;"');
    expect(t.get("v")).toBe("DMARC1");
  });

  it("preserves = inside values (rua URL list)", () => {
    const t = parseDmarcTags("v=DMARC1; p=none; rua=mailto:a@x.com,mailto:b@y.com;");
    expect(t.get("rua")).toBe("mailto:a@x.com,mailto:b@y.com");
  });
});
