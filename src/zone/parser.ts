import {
  RECORD_TYPES,
  type RecordData,
  type RecordType,
  type Zone,
  type ZoneRecord,
} from "./types";

// BIND zone-file subset: handles $TTL, $ORIGIN, multi-line SOA via parens,
// owner-name inheritance from leading whitespace, ; comments, BIND duration
// syntax. Out of scope: $INCLUDE, $GENERATE, IDNs, RRSIG/DNSSEC records.

function isEscaped(line: string, i: number): boolean {
  let backslashes = 0;
  for (let j = i - 1; j >= 0 && line[j] === "\\"; j--) backslashes++;
  return backslashes % 2 === 1;
}

function stripComments(line: string): string {
  let out = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (ch === '"' && !isEscaped(line, i)) inQuote = !inQuote;
    if (ch === ";" && !inQuote) break;
    out += ch;
  }
  return out;
}

// Registrar exports (Loopia, etc.) often emit unquoted TXT records like
// `_dmarc IN TXT v=DMARC1; p=none; rua=...`. BIND treats ; as a comment
// outside quotes, which would truncate the value. Detect this shape and
// wrap the rdata in quotes before comment stripping runs.
const UNQUOTED_TXT_RE =
  /^(\s*\S+\s+(?:\d+\s+)?(?:IN\s+|CH\s+|HS\s+)?|\s+(?:\d+\s+)?(?:IN\s+|CH\s+|HS\s+)?)TXT(\s+)/i;

function quoteUnquotedTxt(line: string): string {
  const m = line.match(UNQUOTED_TXT_RE);
  if (!m) return line;
  const headerEnd = (m.index ?? 0) + m[0].length;
  let rdata = line.slice(headerEnd);
  if (rdata.trimStart().startsWith('"')) return line;
  if (!rdata.trim()) return line;
  // BIND comments at end-of-line are conventionally " ;" (whitespace + ;).
  // Truncate there so the `;` characters embedded in DMARC/SPF survive.
  const cmtIdx = rdata.search(/\s;/);
  if (cmtIdx !== -1) rdata = rdata.slice(0, cmtIdx);
  rdata = rdata.trim();
  if (!rdata) return line;
  const escaped = rdata.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${line.slice(0, headerEnd)}"${escaped}"`;
}

function unquoteTxtForStorage(s: string): string {
  const t = s.trim();
  if (t.length < 2 || !t.startsWith('"') || !t.endsWith('"')) return t;
  let inQuote = false;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '"' && !isEscaped(t, i)) {
      inQuote = !inQuote;
      if (!inQuote && i < t.length - 1) return t; // multi-string TXT, keep as-is
    }
  }
  return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

interface JoinedLine {
  text: string;
  startsBlank: boolean;
}

function joinParenLines(raw: string): JoinedLine[] {
  const rawLines = raw.split(/\r?\n/);
  const out: JoinedLine[] = [];
  let buf = "";
  let depth = 0;
  let startsBlank = false;
  let started = false;
  for (const ln of rawLines) {
    const stripped = stripComments(quoteUnquotedTxt(ln));
    if (!started && stripped.length > 0) {
      startsBlank = /^\s/.test(stripped);
      started = true;
    }
    for (const ch of stripped) {
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
    }
    buf += (buf ? " " : "") + stripped.replace(/[()]/g, " ");
    if (depth === 0) {
      const trimmed = buf.trim();
      if (trimmed) out.push({ text: trimmed, startsBlank });
      buf = "";
      started = false;
      startsBlank = false;
    }
  }
  if (buf.trim()) out.push({ text: buf.trim(), startsBlank });
  return out;
}

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (ch === '"' && !isEscaped(line, i)) {
      inQuote = !inQuote;
      cur += ch;
      continue;
    }
    if (!inQuote && /\s/.test(ch)) {
      if (cur) {
        tokens.push(cur);
        cur = "";
      }
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

function isClass(token: string): boolean {
  return /^(IN|CH|HS)$/i.test(token);
}

function isType(token: string): token is RecordType {
  return RECORD_TYPES.includes(token.toUpperCase() as RecordType);
}

function isTtl(token: string): boolean {
  return /^\d+$/.test(token);
}

function buildRecordData(type: RecordType, rdata: string[]): RecordData {
  switch (type) {
    case "SOA":
      return {
        type: "SOA",
        data: {
          mname: rdata[0] ?? "",
          rname: rdata[1] ?? "",
          serial: rdata[2] ?? "",
          refresh: rdata[3] ?? "",
          retry: rdata[4] ?? "",
          expire: rdata[5] ?? "",
          minimum: rdata[6] ?? "",
        },
      };
    case "NS":
      return { type: "NS", data: { target: rdata[0] ?? "" } };
    case "A":
      return { type: "A", data: { address: rdata[0] ?? "" } };
    case "AAAA":
      return { type: "AAAA", data: { address: rdata[0] ?? "" } };
    case "CNAME":
      return { type: "CNAME", data: { target: rdata[0] ?? "" } };
    case "MX":
      return {
        type: "MX",
        data: { priority: rdata[0] ?? "", target: rdata[1] ?? "" },
      };
    case "TXT":
      return { type: "TXT", data: { text: unquoteTxtForStorage(rdata.join(" ")) } };
    case "SRV":
      return {
        type: "SRV",
        data: {
          priority: rdata[0] ?? "",
          weight: rdata[1] ?? "",
          port: rdata[2] ?? "",
          target: rdata[3] ?? "",
        },
      };
    case "PTR":
      return { type: "PTR", data: { target: rdata[0] ?? "" } };
    case "CAA":
      return {
        type: "CAA",
        data: {
          flags: rdata[0] ?? "",
          tag: rdata[1] ?? "",
          value: rdata.slice(2).join(" "),
        },
      };
  }
}

export interface ParseResult {
  zone: Zone;
  errors: string[];
}

export function parseZone(text: string): ParseResult {
  const errors: string[] = [];
  const lines = joinParenLines(text);
  const records: ZoneRecord[] = [];
  let origin = "";
  let ttl = "";
  let lastOwner = "";

  for (const { text: line, startsBlank } of lines) {
    if (!line) continue;
    if (/^\$ORIGIN\b/i.test(line)) {
      const tokens = tokenize(line);
      origin = tokens[1] ?? "";
      continue;
    }
    if (/^\$TTL\b/i.test(line)) {
      const tokens = tokenize(line);
      ttl = tokens[1] ?? "";
      continue;
    }
    if (/^\$/.test(line)) {
      errors.push(`Unsupported directive: ${line}`);
      continue;
    }

    const tokens = tokenize(line);
    if (tokens.length === 0) continue;

    let idx = 0;
    let name: string;
    if (startsBlank) {
      name = lastOwner;
    } else {
      name = tokens[idx++] ?? "";
      lastOwner = name;
    }

    let recTtl = "";
    let recClass = "IN";
    while (idx < tokens.length) {
      const t = tokens[idx];
      if (t === undefined) break;
      if (isTtl(t)) {
        recTtl = t;
        idx++;
      } else if (isClass(t)) {
        recClass = t.toUpperCase();
        idx++;
      } else break;
    }

    const typeTok = tokens[idx++];
    if (!typeTok || !isType(typeTok)) {
      errors.push(`Unknown record type in line: ${line}`);
      continue;
    }
    const type = typeTok.toUpperCase() as RecordType;
    const rdata = tokens.slice(idx);

    records.push({
      id: crypto.randomUUID(),
      name,
      ttl: recTtl,
      class: recClass,
      record: buildRecordData(type, rdata),
    });
  }

  return { zone: { origin, ttl, records }, errors };
}

export function emptyZone(): Zone {
  return {
    origin: "example.com.",
    ttl: "3600",
    records: [],
  };
}

export function newRecord(type: RecordType = "A"): ZoneRecord {
  return {
    id: crypto.randomUUID(),
    name: "@",
    ttl: "",
    class: "IN",
    record: buildRecordData(type, []),
  };
}
