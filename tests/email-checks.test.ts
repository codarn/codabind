import { describe, expect, it } from "vitest";
import { evaluateEmailConfig, type EmailCheckId } from "../src/email/checks";
import type { Zone, ZoneRecord } from "../src/zone/types";

const id = () => crypto.randomUUID();

const mx = (priority: string, target: string, name = "@"): ZoneRecord => ({
  id: id(), name, ttl: "", class: "IN",
  record: { type: "MX", data: { priority, target } },
});

const txt = (name: string, text: string): ZoneRecord => ({
  id: id(), name, ttl: "", class: "IN",
  record: { type: "TXT", data: { text } },
});

const cname = (name: string, target: string): ZoneRecord => ({
  id: id(), name, ttl: "", class: "IN",
  record: { type: "CNAME", data: { target } },
});

const zone = (records: ZoneRecord[], origin = "example.com."): Zone => ({
  origin, ttl: "3600", records,
});

const findCheck = (zone: Zone, which: EmailCheckId) =>
  evaluateEmailConfig(zone).find((c) => c.id === which)!;

describe("MX check", () => {
  it("missing when zone has no MX at apex", () => {
    expect(findCheck(zone([]), "mx").status).toBe("missing");
  });

  it("ok when at least one apex MX exists", () => {
    const c = findCheck(zone([mx("10", "mail.example.com.")]), "mx");
    expect(c.status).toBe("ok");
    expect(c.details[0]).toContain("mail.example.com");
  });

  it("ignores non-apex MX records (subdomain mail)", () => {
    expect(findCheck(zone([mx("10", "mail.x.com.", "sub")]), "mx").status).toBe("missing");
  });
});

describe("SPF check", () => {
  it("missing when no v=spf1 TXT at apex", () => {
    expect(findCheck(zone([]), "spf").status).toBe("missing");
  });

  it("ok for canonical -all SPF", () => {
    expect(findCheck(zone([txt("@", "v=spf1 include:_spf.google.com -all")]), "spf").status).toBe("ok");
  });

  it("warns when SPF has no all qualifier", () => {
    const c = findCheck(zone([txt("@", "v=spf1 include:_spf.google.com")]), "spf");
    expect(c.status).toBe("warn");
    expect(c.details.join(" ")).toContain("all");
  });

  it("warns on multiple SPF records", () => {
    const c = findCheck(
      zone([txt("@", "v=spf1 -all"), txt("@", "v=spf1 include:other -all")]),
      "spf",
    );
    expect(c.status).toBe("warn");
    expect(c.summary).toContain("2");
  });

  it("warns when ptr mechanism is used", () => {
    const c = findCheck(zone([txt("@", "v=spf1 ptr -all")]), "spf");
    expect(c.status).toBe("warn");
    expect(c.details.join(" ")).toContain("ptr");
  });
});

describe("DKIM check", () => {
  it("warns when no DKIM keys are present", () => {
    expect(findCheck(zone([]), "dkim").status).toBe("warn");
  });

  it("ok with TXT-style DKIM selector", () => {
    const c = findCheck(
      zone([txt("google._domainkey", "v=DKIM1; k=rsa; p=ABC")]),
      "dkim",
    );
    expect(c.status).toBe("ok");
    expect(c.summary).toContain("1");
  });

  it("ok with CNAME-style delegated DKIM (e.g. AhaSend)", () => {
    const c = findCheck(
      zone([cname("ahasend._domainkey", "ahasend._domainkey.aha.send.")]),
      "dkim",
    );
    expect(c.status).toBe("ok");
    expect(c.summary).toContain("1");
  });

  it("counts multiple selectors", () => {
    const c = findCheck(
      zone([
        txt("s1._domainkey", "v=DKIM1; p=A"),
        txt("s2._domainkey", "v=DKIM1; p=B"),
        cname("ahasend._domainkey", "x.aha.send."),
      ]),
      "dkim",
    );
    expect(c.status).toBe("ok");
    expect(c.summary).toContain("3");
  });

  it("recognizes known providers", () => {
    const c = findCheck(zone([txt("google._domainkey", "v=DKIM1; p=ABC")]), "dkim");
    expect(c.details.some((d) => d.includes("Google Workspace"))).toBe(true);
  });
});

describe("DMARC check", () => {
  it("missing when no _dmarc record", () => {
    expect(findCheck(zone([]), "dmarc").status).toBe("missing");
  });

  it("ok with v=DMARC1; p=quarantine; rua=...", () => {
    const c = findCheck(
      zone([txt("_dmarc", "v=DMARC1; p=quarantine; rua=mailto:reports@example.com")]),
      "dmarc",
    );
    expect(c.status).toBe("ok");
    expect(c.summary).toBe("p=quarantine");
  });

  it("warns on p=none (monitor only)", () => {
    const c = findCheck(zone([txt("_dmarc", "v=DMARC1; p=none; rua=mailto:x@example.com")]), "dmarc");
    expect(c.status).toBe("warn");
    expect(c.summary).toBe("p=none");
  });

  it("warns when rua is missing", () => {
    const c = findCheck(zone([txt("_dmarc", "v=DMARC1; p=quarantine")]), "dmarc");
    expect(c.status).toBe("warn");
    expect(c.details.join(" ")).toContain("rua");
  });

  it("warns when v= is wrong", () => {
    const c = findCheck(zone([txt("_dmarc", "p=reject; rua=mailto:x@example.com")]), "dmarc");
    expect(c.status).toBe("warn");
  });

  it("matches FQDN form of _dmarc.<origin>", () => {
    const c = findCheck(
      zone([txt("_dmarc.example.com.", "v=DMARC1; p=quarantine; rua=mailto:x@example.com")]),
      "dmarc",
    );
    expect(c.status).toBe("ok");
  });
});
