import type { Zone, ZoneRecord } from "../zone/types";

export interface DmarcSuggestion {
  title: string;
  rationale: string;
  nextValue: string;
  applyTo: ZoneRecord | null; // null means create new _dmarc record
}

const TAG_ORDER = ["v", "p", "pct", "rua", "ruf", "fo", "adkim", "aspf", "sp"];

function findDmarc(zone: Zone): ZoneRecord | null {
  const cleanOrigin = zone.origin.replace(/\.$/, "").toLowerCase();
  return (
    zone.records.find((r) => {
      if (r.record.type !== "TXT") return false;
      const clean = r.name.replace(/\.$/, "").toLowerCase();
      return clean === "_dmarc" || clean === `_dmarc.${cleanOrigin}`;
    }) ?? null
  );
}

export function parseDmarcTags(text: string): Map<string, string> {
  const tags = new Map<string, string>();
  const cleaned = text.trim().replace(/^"|"$/g, "");
  for (const part of cleaned.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k && v.length > 0) tags.set(k.trim().toLowerCase(), v.join("=").trim());
  }
  return tags;
}

function renderTags(tags: Map<string, string>): string {
  const remaining = new Map(tags);
  const parts: string[] = [];
  for (const k of TAG_ORDER) {
    if (remaining.has(k)) {
      parts.push(`${k}=${remaining.get(k)}`);
      remaining.delete(k);
    }
  }
  for (const [k, v] of remaining) parts.push(`${k}=${v}`);
  return parts.join("; ") + ";";
}

function withTags(text: string, updates: Record<string, string>): string {
  const tags = parseDmarcTags(text);
  for (const [k, v] of Object.entries(updates)) tags.set(k, v);
  return renderTags(tags);
}

function defaultMailbox(zone: Zone): string {
  const origin = zone.origin.replace(/\.$/, "") || "example.com";
  return `mailto:dmarc@${origin}`;
}

export function suggestDmarcStep(zone: Zone): DmarcSuggestion | null {
  const dmarc = findDmarc(zone);
  const mailbox = defaultMailbox(zone);

  if (!dmarc || dmarc.record.type !== "TXT") {
    return {
      title: "Start with monitoring",
      rationale: "Add a p=none record with rua= to gather reports before enforcing.",
      nextValue: renderTags(
        new Map([["v", "DMARC1"], ["p", "none"], ["rua", mailbox], ["fo", "1"]]),
      ),
      applyTo: null,
    };
  }

  const tags = parseDmarcTags(dmarc.record.data.text);
  const policy = (tags.get("p") ?? "none").toLowerCase();
  const pct = Number.parseInt(tags.get("pct") ?? "100", 10);
  const hasRua = tags.has("rua");

  if (!hasRua) {
    return {
      title: "Add aggregate reporting",
      rationale:
        "Without rua= you can't see who is sending mail \"from\" your domain or how it authenticates.",
      nextValue: withTags(dmarc.record.data.text, { rua: mailbox, fo: tags.get("fo") ?? "1" }),
      applyTo: dmarc,
    };
  }

  if (policy === "none") {
    return {
      title: "Ramp to quarantine (25 %)",
      rationale:
        "After 2–4 weeks of clean reports at p=none, quarantine a quarter of failing mail.",
      nextValue: withTags(dmarc.record.data.text, { p: "quarantine", pct: "25" }),
      applyTo: dmarc,
    };
  }

  if (policy === "quarantine" && pct < 100) {
    return {
      title: "Ramp to quarantine (100 %)",
      rationale: "Increase enforcement to all failing mail.",
      nextValue: withTags(dmarc.record.data.text, { p: "quarantine", pct: "100" }),
      applyTo: dmarc,
    };
  }

  if (policy === "quarantine" && pct === 100) {
    return {
      title: "Ramp to reject",
      rationale: "After 2 weeks at quarantine 100 % with no false positives, escalate to reject.",
      nextValue: withTags(dmarc.record.data.text, { p: "reject", pct: "100" }),
      applyTo: dmarc,
    };
  }

  return null; // p=reject — fully enforced
}
