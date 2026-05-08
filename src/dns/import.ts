import { KNOWN_DKIM_PROVIDERS } from "../email/dkim-providers";
import type { RecordType, Zone, ZoneRecord } from "../zone/types";
import { query } from "./query";
import { DEFAULT_RESOLVERS } from "./resolvers";
import type { DohAnswer } from "./types";

const APEX_TYPES: RecordType[] = ["SOA", "NS", "A", "AAAA", "MX", "TXT", "CAA"];

const SUBDOMAIN_PROBES: Array<{ name: string; types: RecordType[] }> = [
  { name: "www", types: ["A", "AAAA", "CNAME"] },
  { name: "_dmarc", types: ["TXT"] },
  { name: "mail", types: ["A", "AAAA", "CNAME"] },
  { name: "autodiscover", types: ["CNAME"] },
  ...Object.keys(KNOWN_DKIM_PROVIDERS).map((sel) => ({
    name: `${sel}._domainkey`,
    types: ["TXT", "CNAME"] as RecordType[],
  })),
];

export interface DnsImportResult {
  zone: Zone;
  errors: string[];
}

export async function importFromDns(
  resolverId: string,
  rawDomain: string,
  signal?: AbortSignal,
): Promise<DnsImportResult> {
  const resolver = DEFAULT_RESOLVERS.find((r) => r.id === resolverId);
  if (!resolver) {
    return { zone: emptyZoneFor(rawDomain), errors: [`Unknown resolver: ${resolverId}`] };
  }

  const cleanDomain = rawDomain.trim().replace(/^\.+|\.+$/g, "").toLowerCase();
  if (!cleanDomain) {
    return { zone: emptyZoneFor(""), errors: ["Domain is required"] };
  }

  const origin = `${cleanDomain}.`;
  const errors: string[] = [];
  const records: ZoneRecord[] = [];

  // Apex records — single name "@", multiple RR types
  await Promise.all(
    APEX_TYPES.map(async (type) => {
      const resp = await query(resolver, origin, type, signal);
      if (resp.status === "error") {
        errors.push(`${type} @ ${cleanDomain}: ${resp.errorMessage ?? "fetch failed"}`);
        return;
      }
      for (const ans of resp.answers) {
        const rec = answerToRecord("@", ans, type);
        if (rec) records.push(rec);
      }
    }),
  );

  // Best-effort subdomain probes
  await Promise.all(
    SUBDOMAIN_PROBES.flatMap(({ name, types }) =>
      types.map(async (type) => {
        const fqdn = `${name}.${origin}`;
        const resp = await query(resolver, fqdn, type, signal);
        if (resp.status !== "ok") return;
        for (const ans of resp.answers) {
          const rec = answerToRecord(name, ans, type);
          if (rec) records.push(rec);
        }
      }),
    ),
  );

  const ttl = pickZoneTtl(records);
  return { zone: { origin, ttl, records }, errors };
}

function answerToRecord(name: string, ans: DohAnswer, type: RecordType): ZoneRecord | null {
  const id = crypto.randomUUID();
  const ttl = String(ans.TTL);
  const cls = "IN";
  const parts = ans.data.split(/\s+/);

  switch (type) {
    case "A":
    case "AAAA":
      return { id, name, ttl, class: cls, record: { type, data: { address: ans.data } } };
    case "NS":
    case "CNAME":
    case "PTR":
      return { id, name, ttl, class: cls, record: { type, data: { target: ans.data } } };
    case "MX":
      return {
        id, name, ttl, class: cls,
        record: { type: "MX", data: { priority: parts[0] ?? "10", target: parts.slice(1).join(" ") } },
      };
    case "TXT":
      return { id, name, ttl, class: cls, record: { type: "TXT", data: { text: stripOuterQuotes(ans.data) } } };
    case "SOA":
      return {
        id, name, ttl, class: cls,
        record: {
          type: "SOA",
          data: {
            mname: parts[0] ?? "",
            rname: parts[1] ?? "",
            serial: parts[2] ?? "",
            refresh: parts[3] ?? "",
            retry: parts[4] ?? "",
            expire: parts[5] ?? "",
            minimum: parts[6] ?? "",
          },
        },
      };
    case "SRV":
      return {
        id, name, ttl, class: cls,
        record: {
          type: "SRV",
          data: {
            priority: parts[0] ?? "",
            weight: parts[1] ?? "",
            port: parts[2] ?? "",
            target: parts.slice(3).join(" "),
          },
        },
      };
    case "CAA":
      return {
        id, name, ttl, class: cls,
        record: {
          type: "CAA",
          data: {
            flags: parts[0] ?? "0",
            tag: parts[1] ?? "issue",
            value: stripOuterQuotes(parts.slice(2).join(" ")),
          },
        },
      };
  }
}

function pickZoneTtl(records: ZoneRecord[]): string {
  const soa = records.find((r) => r.record.type === "SOA");
  return soa?.ttl || "3600";
}

function emptyZoneFor(domain: string): Zone {
  const cleaned = domain.trim().replace(/^\.+|\.+$/g, "");
  return { origin: cleaned ? `${cleaned}.` : "", ttl: "3600", records: [] };
}

function stripOuterQuotes(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return s;
}
