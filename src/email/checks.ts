import type { Zone, ZoneRecord } from "../zone/types";

export type EmailCheckId = "mx" | "spf" | "dkim" | "dmarc";
export type EmailCheckStatus = "ok" | "warn" | "missing";

export interface EmailCheck {
  id: EmailCheckId;
  title: string;
  status: EmailCheckStatus;
  summary: string;
  details: string[];
  records: ZoneRecord[];
}

const KNOWN_DKIM_PROVIDERS: Record<string, string> = {
  google: "Google Workspace",
  selector1: "Microsoft 365",
  selector2: "Microsoft 365",
  mailgun: "Mailgun",
  k1: "Mailchimp",
  k2: "Mailchimp",
  k3: "Mailchimp",
  pm: "Postmark",
  sendgrid: "SendGrid",
  s1: "SendGrid",
  s2: "SendGrid",
  zoho: "Zoho",
  amazonses: "Amazon SES",
  ahasend: "AhaSend",
  ahasend2: "AhaSend",
};

function stripTrailingDot(s: string): string {
  return s.replace(/\.$/, "");
}

function isApex(name: string, origin: string): boolean {
  if (name === "@" || name === "") return true;
  return stripTrailingDot(name).toLowerCase() === stripTrailingDot(origin).toLowerCase();
}

function matchesPrefix(name: string, prefix: string, origin: string): boolean {
  const clean = stripTrailingDot(name).toLowerCase();
  if (clean === prefix) return true;
  const fqdnPrefix = `${prefix}.${stripTrailingDot(origin).toLowerCase()}`;
  return clean === fqdnPrefix;
}

function looksLikeDomainkey(name: string): boolean {
  return /(^|\.)_domainkey(\.|$)/i.test(stripTrailingDot(name));
}

function selectorOf(name: string): string {
  const clean = stripTrailingDot(name);
  const idx = clean.toLowerCase().indexOf("._domainkey");
  return idx >= 0 ? clean.slice(0, idx) : clean;
}

function parseDmarcTags(text: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const part of text.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k && v.length > 0) tags.set(k.trim().toLowerCase(), v.join("=").trim());
  }
  return tags;
}

function checkMx(zone: Zone): EmailCheck {
  const apexMx = zone.records.filter(
    (r) => r.record.type === "MX" && isApex(r.name, zone.origin),
  );
  if (apexMx.length === 0) {
    return {
      id: "mx",
      title: "MX",
      status: "missing",
      summary: "No MX records",
      details: ["Domain cannot receive mail without MX records at the apex."],
      records: [],
    };
  }
  const targets = apexMx.flatMap((r) =>
    r.record.type === "MX" ? [`${r.record.data.priority}  ${stripTrailingDot(r.record.data.target)}`] : [],
  );
  return {
    id: "mx",
    title: "MX",
    status: "ok",
    summary: `${apexMx.length} record${apexMx.length === 1 ? "" : "s"}`,
    details: targets,
    records: apexMx,
  };
}

function checkSpf(zone: Zone): EmailCheck {
  const apexTxt = zone.records.filter(
    (r) => r.record.type === "TXT" && isApex(r.name, zone.origin),
  );
  const spfRecords = apexTxt.filter(
    (r) => r.record.type === "TXT" && /^"?v=spf1\b/i.test(r.record.data.text.trim()),
  );
  if (spfRecords.length === 0) {
    return {
      id: "spf",
      title: "SPF",
      status: "missing",
      summary: "No SPF record",
      details: ["Add a TXT at apex starting with v=spf1 to declare authorized senders."],
      records: [],
    };
  }
  if (spfRecords.length > 1) {
    return {
      id: "spf",
      title: "SPF",
      status: "warn",
      summary: `${spfRecords.length} SPF records`,
      details: ["Multiple SPF records — receivers will treat the domain as unprotected. Merge into one."],
      records: spfRecords,
    };
  }
  const spf = spfRecords[0]!;
  if (spf.record.type !== "TXT") return placeholder("spf");
  const text = spf.record.data.text.trim().replace(/^"|"$/g, "");
  const issues: string[] = [];
  if (!/(\s|^)([+\-~?])?all\s*$/i.test(text)) {
    issues.push("Should end with an 'all' qualifier (e.g. ~all or -all).");
  }
  if (/\bptr\b/i.test(text)) {
    issues.push("'ptr' mechanism is deprecated and slow — replace it.");
  }
  const lookups = (text.match(/\b(include|a|mx|exists|redirect)\b/gi) ?? []).length;
  if (lookups > 10) {
    issues.push(`SPF allows ≤10 DNS lookups; this record has ${lookups}.`);
  }
  return {
    id: "spf",
    title: "SPF",
    status: issues.length > 0 ? "warn" : "ok",
    summary: issues.length > 0 ? "Has lint warnings" : "Configured",
    details: [text, ...issues],
    records: [spf],
  };
}

function checkDkim(zone: Zone): EmailCheck {
  const dkimRecords = zone.records.filter(
    (r) =>
      (r.record.type === "TXT" || r.record.type === "CNAME") &&
      looksLikeDomainkey(r.name),
  );
  if (dkimRecords.length === 0) {
    return {
      id: "dkim",
      title: "DKIM",
      status: "warn",
      summary: "No DKIM keys",
      details: [
        "DKIM signs outbound mail. Most providers (Google, Microsoft, AhaSend, Mailgun) require it.",
      ],
      records: [],
    };
  }
  const selectors = dkimRecords.map((r) => selectorOf(r.name));
  const provider = (sel: string): string => {
    const known = KNOWN_DKIM_PROVIDERS[sel.toLowerCase()];
    return known ? `${sel} (${known})` : sel;
  };
  return {
    id: "dkim",
    title: "DKIM",
    status: "ok",
    summary: `${dkimRecords.length} selector${dkimRecords.length === 1 ? "" : "s"}`,
    details: selectors.map(provider),
    records: dkimRecords,
  };
}

function checkDmarc(zone: Zone): EmailCheck {
  const dmarc = zone.records.find(
    (r) => r.record.type === "TXT" && matchesPrefix(r.name, "_dmarc", zone.origin),
  );
  if (!dmarc || dmarc.record.type !== "TXT") {
    return {
      id: "dmarc",
      title: "DMARC",
      status: "missing",
      summary: "No DMARC",
      details: ["Add TXT at _dmarc with v=DMARC1; p=quarantine; rua=mailto:reports@…"],
      records: [],
    };
  }
  const text = dmarc.record.data.text.trim().replace(/^"|"$/g, "");
  const tags = parseDmarcTags(text);
  const issues: string[] = [];
  if (tags.get("v") !== "DMARC1") issues.push("Must start with v=DMARC1");
  const policy = tags.get("p");
  if (!policy) {
    issues.push("Missing p= policy tag");
  } else if (!["none", "quarantine", "reject"].includes(policy)) {
    issues.push(`Unknown p= policy '${policy}' — use none, quarantine, or reject.`);
  } else if (policy === "none") {
    issues.push("p=none is monitor-only; consider quarantine or reject once reports look clean.");
  }
  if (!tags.has("rua")) {
    issues.push("No rua= for aggregate reports — add one to monitor authentication.");
  }
  return {
    id: "dmarc",
    title: "DMARC",
    status: issues.length > 0 ? "warn" : "ok",
    summary: policy ? `p=${policy}` : "Misconfigured",
    details: [text, ...issues],
    records: [dmarc],
  };
}

function placeholder(id: EmailCheckId): EmailCheck {
  return { id, title: id.toUpperCase(), status: "missing", summary: "—", details: [], records: [] };
}

export function evaluateEmailConfig(zone: Zone): EmailCheck[] {
  return [checkMx(zone), checkSpf(zone), checkDkim(zone), checkDmarc(zone)];
}
