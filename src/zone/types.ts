export type RecordType =
  | "SOA"
  | "NS"
  | "A"
  | "AAAA"
  | "CNAME"
  | "MX"
  | "TXT"
  | "SRV"
  | "PTR"
  | "CAA";

export const RECORD_TYPES: RecordType[] = [
  "SOA",
  "NS",
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "SRV",
  "PTR",
  "CAA",
];

export interface SoaData {
  mname: string;
  rname: string;
  serial: string;
  refresh: string;
  retry: string;
  expire: string;
  minimum: string;
}

export interface MxData {
  priority: string;
  target: string;
}

export interface SrvData {
  priority: string;
  weight: string;
  port: string;
  target: string;
}

export interface CaaData {
  flags: string;
  tag: string;
  value: string;
}

export type RecordData =
  | { type: "SOA"; data: SoaData }
  | { type: "NS"; data: { target: string } }
  | { type: "A"; data: { address: string } }
  | { type: "AAAA"; data: { address: string } }
  | { type: "CNAME"; data: { target: string } }
  | { type: "MX"; data: MxData }
  | { type: "TXT"; data: { text: string } }
  | { type: "SRV"; data: SrvData }
  | { type: "PTR"; data: { target: string } }
  | { type: "CAA"; data: CaaData };

export interface ZoneRecord {
  id: string;
  name: string;
  ttl: string;
  class: string;
  record: RecordData;
}

export interface Zone {
  origin: string;
  ttl: string;
  records: ZoneRecord[];
}

export type ValidationIssue = {
  recordId?: string;
  field?: string;
  message: string;
  severity: "error" | "warning";
};
