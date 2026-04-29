import type { RecordType, ZoneRecord } from "../zone/types";
import type {
  DohAnswer,
  PerResolverOutcome,
  RecordCheckStatus,
  ResolverResponse,
} from "./types";

export const TYPE_TO_IANA: Record<RecordType, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  CAA: 257,
};

function normalizeName(n: string): string {
  return n.toLowerCase().replace(/\.$/, "");
}

function unwrapTxt(t: string): string {
  const trimmed = t.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return trimmed;
}

export function expectedValuesFor(rec: ZoneRecord): string[] {
  const r = rec.record;
  switch (r.type) {
    case "A":
    case "AAAA":
      return [r.data.address.toLowerCase()];
    case "NS":
    case "CNAME":
    case "PTR":
      return [normalizeName(r.data.target)];
    case "MX":
      return [`${r.data.priority} ${normalizeName(r.data.target)}`];
    case "TXT":
      return [unwrapTxt(r.data.text)];
    case "SOA":
      return [r.data.serial];
    case "SRV":
      return [
        `${r.data.priority} ${r.data.weight} ${r.data.port} ${normalizeName(r.data.target)}`,
      ];
    case "CAA":
      return [
        `${r.data.flags} ${r.data.tag.toLowerCase()} ${unwrapTxt(r.data.value)}`,
      ];
  }
}

export function liveValueFor(rec: ZoneRecord, ans: DohAnswer): string {
  const parts = ans.data.split(/\s+/);
  switch (rec.record.type) {
    case "A":
    case "AAAA":
      return ans.data.toLowerCase();
    case "NS":
    case "CNAME":
    case "PTR":
      return normalizeName(ans.data);
    case "MX":
      return `${parts[0] ?? ""} ${normalizeName(parts.slice(1).join(" "))}`;
    case "TXT":
      return unwrapTxt(ans.data);
    case "SOA":
      return parts[2] ?? "";
    case "SRV":
      return `${parts[0] ?? ""} ${parts[1] ?? ""} ${parts[2] ?? ""} ${normalizeName(parts.slice(3).join(" "))}`;
    case "CAA":
      return `${parts[0] ?? ""} ${(parts[1] ?? "").toLowerCase()} ${unwrapTxt(parts.slice(2).join(" "))}`;
  }
}

function outcomeFor(rec: ZoneRecord, resp: ResolverResponse): PerResolverOutcome {
  if (resp.status === "error") return "error";
  const ianaType = TYPE_TO_IANA[rec.record.type];
  const expected = new Set(expectedValuesFor(rec).map((v) => v.toLowerCase()));
  const liveValues = resp.answers
    .filter((a) => a.type === ianaType)
    .map((a) => liveValueFor(rec, a).toLowerCase());
  if (liveValues.length === 0) return "missing";
  return liveValues.some((v) => expected.has(v)) ? "match" : "stale";
}

export function statusFor(
  rec: ZoneRecord,
  perResolver: Map<string, ResolverResponse>,
): RecordCheckStatus {
  if (perResolver.size === 0) return "error";

  const outcomes: PerResolverOutcome[] = [];
  for (const resp of perResolver.values()) outcomes.push(outcomeFor(rec, resp));

  const counts = {
    match: outcomes.filter((o) => o === "match").length,
    stale: outcomes.filter((o) => o === "stale").length,
    missing: outcomes.filter((o) => o === "missing").length,
    error: outcomes.filter((o) => o === "error").length,
  };

  const total = outcomes.length;
  if (counts.error === total) return "error";
  const responding = total - counts.error;
  if (counts.match === responding) return "match";
  if (counts.match === 0 && counts.stale === 0) return "missing";
  if (counts.match === 0) return "mismatch";
  if (counts.stale > 0 || counts.missing > 0) return "propagating";
  return "diverged";
}

export const PER_RESOLVER_OUTCOME = outcomeFor;
