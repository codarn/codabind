import { UINT16_MAX, UINT32_MAX } from "./constants";
import { fqdn } from "./tree";
import type { ValidationIssue, Zone, ZoneRecord } from "./types";

const HOSTNAME_RE = /^(?:\*\.)?(?:[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)*[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.?$/;
const NAME_RE = /^(?:@|\*|[a-zA-Z0-9_*]([a-zA-Z0-9_*-]*[a-zA-Z0-9_*])?(?:\.[a-zA-Z0-9_*]([a-zA-Z0-9_*-]*[a-zA-Z0-9_*])?)*\.?)$/;
const CAA_TAG_RE = /^(issue|issuewild|iodef|contactemail|contactphone)$/i;
const CLASS_RE = /^(IN|CH|HS)$/i;

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };

export function isIPv4(s: string): boolean {
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every((p) => {
    const n = Number(p);
    return n >= 0 && n <= 255 && String(n) === p;
  });
}

export function isIPv6(s: string): boolean {
  if (!/^[0-9a-fA-F:]+$/.test(s)) return false;
  if ((s.match(/::/g) || []).length > 1) return false;
  const groups = s.split(":");
  if (groups.length > 8) return false;
  if (!s.includes("::") && groups.length !== 8) return false;
  return groups.every((g) => g === "" || /^[0-9a-fA-F]{1,4}$/.test(g));
}

export function isHostname(s: string): boolean {
  if (!s) return false;
  if (s === "@") return true;
  return HOSTNAME_RE.test(s);
}

export function isName(s: string): boolean {
  if (!s) return false;
  if (s === "@") return true;
  return NAME_RE.test(s);
}

function isUint(s: string, max = UINT32_MAX): boolean {
  if (!/^\d+$/.test(s)) return false;
  const n = Number(s);
  return n >= 0 && n <= max;
}

export function parseDuration(s: string): number | null {
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  if (!/^(\d+[smhdw])+$/i.test(s)) return null;
  let total = 0;
  for (const m of s.matchAll(/(\d+)([smhdw])/gi)) {
    const num = m[1];
    const unit = m[2];
    if (num === undefined || unit === undefined) continue;
    const seconds = UNIT_SECONDS[unit.toLowerCase()];
    if (seconds === undefined) continue;
    total += Number(num) * seconds;
  }
  return total;
}

function isTtlValue(s: string): boolean {
  const n = parseDuration(s);
  return n !== null && n >= 0 && n <= UINT32_MAX;
}

function issue(
  rec: ZoneRecord,
  field: string | undefined,
  message: string,
  severity: ValidationIssue["severity"] = "error",
): ValidationIssue {
  return field !== undefined
    ? { recordId: rec.id, field, message, severity }
    : { recordId: rec.id, message, severity };
}

export function validateZone(zone: Zone): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (zone.origin && !isHostname(zone.origin)) {
    issues.push({ field: "origin", message: "Origin must be a valid domain (typically ending with a dot).", severity: "error" });
  } else if (zone.origin && !zone.origin.endsWith(".")) {
    issues.push({ field: "origin", message: "Origin should be fully qualified (end with a dot).", severity: "warning" });
  }
  if (zone.ttl && !isTtlValue(zone.ttl)) {
    issues.push({ field: "ttl", message: "$TTL must be a non-negative integer or BIND duration (e.g. 1h, 1d).", severity: "error" });
  }

  const soaCount = zone.records.filter((r) => r.record.type === "SOA").length;
  if (soaCount === 0) issues.push({ message: "Zone is missing an SOA record.", severity: "warning" });
  if (soaCount > 1) issues.push({ message: "Zone has more than one SOA record.", severity: "error" });

  const nsCount = zone.records.filter((r) => r.record.type === "NS").length;
  if (nsCount === 0) issues.push({ message: "Zone has no NS records.", severity: "warning" });

  const cnameByFqdn = new Map<string, ZoneRecord[]>();
  for (const r of zone.records) {
    if (r.record.type !== "CNAME") continue;
    const key = fqdn(r, zone.origin);
    const arr = cnameByFqdn.get(key) ?? [];
    arr.push(r);
    cnameByFqdn.set(key, arr);
  }
  for (const r of zone.records) {
    if (r.record.type === "CNAME") continue;
    const key = fqdn(r, zone.origin);
    if (cnameByFqdn.has(key)) {
      issues.push(issue(
        r,
        undefined,
        `Name "${r.name}" has a CNAME and another record (${r.record.type}); CNAME must not coexist with other records.`,
      ));
    }
  }

  for (const rec of zone.records) issues.push(...validateRecord(rec));
  return issues;
}

const TTL_DURATION_HINT = "must be a non-negative integer or BIND duration (e.g. 1h, 1d).";

export function validateRecord(rec: ZoneRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isName(rec.name)) issues.push(issue(rec, "name", "Invalid name."));
  if (rec.ttl && !isTtlValue(rec.ttl)) issues.push(issue(rec, "ttl", `TTL ${TTL_DURATION_HINT}`));
  if (rec.class && !CLASS_RE.test(rec.class)) issues.push(issue(rec, "class", "Class should be IN, CH, or HS.", "warning"));

  const r = rec.record;
  switch (r.type) {
    case "A":
      if (!isIPv4(r.data.address)) issues.push(issue(rec, "address", "Invalid IPv4 address."));
      break;
    case "AAAA":
      if (!isIPv6(r.data.address)) issues.push(issue(rec, "address", "Invalid IPv6 address."));
      break;
    case "NS":
    case "CNAME":
    case "PTR":
      if (!isHostname(r.data.target)) issues.push(issue(rec, "target", `${r.type} target must be a hostname.`));
      break;
    case "MX":
      if (!isUint(r.data.priority, UINT16_MAX)) issues.push(issue(rec, "priority", "Priority must be 0-65535."));
      if (!isHostname(r.data.target)) issues.push(issue(rec, "target", "MX target must be a hostname."));
      break;
    case "TXT":
      if (!r.data.text) issues.push(issue(rec, "text", "TXT cannot be empty."));
      break;
    case "SRV":
      if (!isUint(r.data.priority, UINT16_MAX)) issues.push(issue(rec, "priority", "Priority must be 0-65535."));
      if (!isUint(r.data.weight, UINT16_MAX)) issues.push(issue(rec, "weight", "Weight must be 0-65535."));
      if (!isUint(r.data.port, UINT16_MAX)) issues.push(issue(rec, "port", "Port must be 0-65535."));
      if (!isHostname(r.data.target)) issues.push(issue(rec, "target", "SRV target must be a hostname."));
      break;
    case "SOA":
      if (!isHostname(r.data.mname)) issues.push(issue(rec, "mname", "Primary NS (mname) must be a hostname."));
      if (!isHostname(r.data.rname)) issues.push(issue(rec, "rname", "Responsible (rname) must be in hostname form."));
      if (!isUint(r.data.serial)) issues.push(issue(rec, "serial", "serial must be a non-negative integer."));
      for (const f of ["refresh", "retry", "expire", "minimum"] as const) {
        if (!isTtlValue(r.data[f])) issues.push(issue(rec, f, `${f} ${TTL_DURATION_HINT}`));
      }
      break;
    case "CAA":
      if (!isUint(r.data.flags, 255)) issues.push(issue(rec, "flags", "CAA flags must be 0-255."));
      if (!CAA_TAG_RE.test(r.data.tag)) issues.push(issue(rec, "tag", "CAA tag should be issue, issuewild, iodef, contactemail, or contactphone.", "warning"));
      if (!r.data.value) issues.push(issue(rec, "value", "CAA value cannot be empty."));
      break;
  }
  return issues;
}
