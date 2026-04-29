import { COLUMN_WIDTHS, MAX_TXT_CHARSTRING_BYTES } from "./constants";
import type { Zone, ZoneRecord } from "./types";

function looksQuoted(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t[0] !== '"') return false;
  let inQuote = false;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '"') {
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && t[j] === "\\"; j--) backslashes++;
      if (backslashes % 2 === 0) inQuote = !inQuote;
    } else if (!inQuote && !/\s/.test(t[i] ?? "")) {
      return false;
    }
  }
  return !inQuote;
}

function encodeTxt(text: string): string {
  const t = text.trim();
  if (!t) return '""';
  if (looksQuoted(t)) return t;
  const escaped = t.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const bytes = new TextEncoder().encode(escaped);
  if (bytes.length <= MAX_TXT_CHARSTRING_BYTES) return `"${escaped}"`;
  const decoder = new TextDecoder("utf-8");
  const chunks: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    let end = Math.min(i + MAX_TXT_CHARSTRING_BYTES, bytes.length);
    if (end < bytes.length) {
      while (end > i && (bytes[end]! & 0xc0) === 0x80) end--;
    }
    if (end === i) end = Math.min(i + MAX_TXT_CHARSTRING_BYTES, bytes.length);
    chunks.push(`"${decoder.decode(bytes.slice(i, end))}"`);
    i = end;
  }
  return chunks.join(" ");
}

function rdataString(rec: ZoneRecord): string {
  const r = rec.record;
  switch (r.type) {
    case "SOA":
      return `${r.data.mname} ${r.data.rname} (\n  ${r.data.serial} ; serial\n  ${r.data.refresh} ; refresh\n  ${r.data.retry} ; retry\n  ${r.data.expire} ; expire\n  ${r.data.minimum} ; minimum\n)`;
    case "NS":
    case "CNAME":
    case "PTR":
      return r.data.target;
    case "A":
    case "AAAA":
      return r.data.address;
    case "MX":
      return `${r.data.priority} ${r.data.target}`;
    case "TXT":
      return encodeTxt(r.data.text);
    case "SRV":
      return `${r.data.priority} ${r.data.weight} ${r.data.port} ${r.data.target}`;
    case "CAA":
      return `${r.data.flags} ${r.data.tag} ${r.data.value}`;
  }
}

function pad(s: string, width: number): string {
  return s.length >= width ? s + " " : s + " ".repeat(width - s.length);
}

export function serializeZone(zone: Zone): string {
  const out: string[] = [];
  if (zone.ttl) out.push(`$TTL ${zone.ttl}`);
  if (zone.origin) out.push(`$ORIGIN ${zone.origin}`);
  if (out.length) out.push("");

  for (const rec of zone.records) {
    const name = pad(rec.name || "@", COLUMN_WIDTHS.name);
    const ttl = pad(rec.ttl, COLUMN_WIDTHS.ttl);
    const cls = pad(rec.class || "IN", COLUMN_WIDTHS.class);
    const type = pad(rec.record.type, COLUMN_WIDTHS.type);
    out.push(`${name}${ttl}${cls}${type}${rdataString(rec)}`);
  }
  return out.join("\n") + "\n";
}
