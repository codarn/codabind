import type { ValidationIssue, Zone, ZoneRecord } from "./types";
import { fqdn } from "./tree";

const HOSTNAME_RE = /^(?:\*\.)?(?:[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)*[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.?$/;
const NAME_RE = /^(?:@|\*|[a-zA-Z0-9_*]([a-zA-Z0-9_*-]*[a-zA-Z0-9_*])?(?:\.[a-zA-Z0-9_*]([a-zA-Z0-9_*-]*[a-zA-Z0-9_*])?)*\.?)$/;

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

function isUint(s: string, max = 4294967295): boolean {
  if (!/^\d+$/.test(s)) return false;
  const n = Number(s);
  return n >= 0 && n <= max;
}

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };

export function parseDuration(s: string): number | null {
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const re = /^(\d+[smhdw])+$/i;
  if (!re.test(s)) return null;
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

function isTtlValue(s: string, max = 4294967295): boolean {
  const n = parseDuration(s);
  return n !== null && n >= 0 && n <= max;
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
    if (r.record.type === "CNAME") {
      const key = fqdn(r, zone.origin);
      const arr = cnameByFqdn.get(key) ?? [];
      arr.push(r);
      cnameByFqdn.set(key, arr);
    }
  }
  for (const r of zone.records) {
    if (r.record.type === "CNAME") continue;
    const key = fqdn(r, zone.origin);
    if (cnameByFqdn.has(key)) {
      issues.push({
        recordId: r.id,
        message: `Name "${r.name}" has a CNAME and another record (${r.record.type}); CNAME must not coexist with other records.`,
        severity: "error",
      });
    }
  }

  for (const rec of zone.records) {
    issues.push(...validateRecord(rec));
  }

  return issues;
}

export function validateRecord(rec: ZoneRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isName(rec.name)) {
    issues.push({ recordId: rec.id, field: "name", message: "Invalid name.", severity: "error" });
  }
  if (rec.ttl && !isTtlValue(rec.ttl)) {
    issues.push({ recordId: rec.id, field: "ttl", message: "TTL must be a non-negative integer or BIND duration (e.g. 1h, 1d).", severity: "error" });
  }
  if (rec.class && !/^(IN|CH|HS)$/i.test(rec.class)) {
    issues.push({ recordId: rec.id, field: "class", message: "Class should be IN, CH, or HS.", severity: "warning" });
  }

  const r = rec.record;
  switch (r.type) {
    case "A":
      if (!isIPv4(r.data.address)) issues.push({ recordId: rec.id, field: "address", message: "Invalid IPv4 address.", severity: "error" });
      break;
    case "AAAA":
      if (!isIPv6(r.data.address)) issues.push({ recordId: rec.id, field: "address", message: "Invalid IPv6 address.", severity: "error" });
      break;
    case "NS":
      if (!isHostname(r.data.target)) issues.push({ recordId: rec.id, field: "target", message: "NS target must be a hostname.", severity: "error" });
      break;
    case "CNAME":
      if (!isHostname(r.data.target)) issues.push({ recordId: rec.id, field: "target", message: "CNAME target must be a hostname.", severity: "error" });
      break;
    case "PTR":
      if (!isHostname(r.data.target)) issues.push({ recordId: rec.id, field: "target", message: "PTR target must be a hostname.", severity: "error" });
      break;
    case "MX":
      if (!isUint(r.data.priority, 65535)) issues.push({ recordId: rec.id, field: "priority", message: "Priority must be 0-65535.", severity: "error" });
      if (!isHostname(r.data.target)) issues.push({ recordId: rec.id, field: "target", message: "MX target must be a hostname.", severity: "error" });
      break;
    case "TXT":
      if (!r.data.text) issues.push({ recordId: rec.id, field: "text", message: "TXT cannot be empty.", severity: "error" });
      break;
    case "SRV":
      if (!isUint(r.data.priority, 65535)) issues.push({ recordId: rec.id, field: "priority", message: "Priority must be 0-65535.", severity: "error" });
      if (!isUint(r.data.weight, 65535)) issues.push({ recordId: rec.id, field: "weight", message: "Weight must be 0-65535.", severity: "error" });
      if (!isUint(r.data.port, 65535)) issues.push({ recordId: rec.id, field: "port", message: "Port must be 0-65535.", severity: "error" });
      if (!isHostname(r.data.target)) issues.push({ recordId: rec.id, field: "target", message: "SRV target must be a hostname.", severity: "error" });
      break;
    case "SOA":
      if (!isHostname(r.data.mname)) issues.push({ recordId: rec.id, field: "mname", message: "Primary NS (mname) must be a hostname.", severity: "error" });
      if (!isHostname(r.data.rname)) issues.push({ recordId: rec.id, field: "rname", message: "Responsible (rname) must be in hostname form.", severity: "error" });
      if (!isUint(r.data.serial)) {
        issues.push({ recordId: rec.id, field: "serial", message: "serial must be a non-negative integer.", severity: "error" });
      }
      for (const f of ["refresh", "retry", "expire", "minimum"] as const) {
        if (!isTtlValue(r.data[f])) {
          issues.push({ recordId: rec.id, field: f, message: `${f} must be a non-negative integer or BIND duration (e.g. 1h, 1d).`, severity: "error" });
        }
      }
      break;
    case "CAA":
      if (!isUint(r.data.flags, 255)) issues.push({ recordId: rec.id, field: "flags", message: "CAA flags must be 0-255.", severity: "error" });
      if (!/^(issue|issuewild|iodef|contactemail|contactphone)$/i.test(r.data.tag)) {
        issues.push({ recordId: rec.id, field: "tag", message: "CAA tag should be issue, issuewild, iodef, contactemail, or contactphone.", severity: "warning" });
      }
      if (!r.data.value) issues.push({ recordId: rec.id, field: "value", message: "CAA value cannot be empty.", severity: "error" });
      break;
  }
  return issues;
}
