import type { RecordCheckResult } from "../dns/types";
import {
  RECORD_TYPES,
  type RecordData,
  type RecordType,
  type ValidationIssue,
  type ZoneRecord,
} from "../zone/types";
import { Field, fieldError } from "./Field";
import { RdataEditor } from "./RdataEditor";
import { ResolverChecks } from "./ResolverChecks";

interface RecordRowProps {
  record: ZoneRecord;
  issues: ValidationIssue[];
  checkResult?: RecordCheckResult | undefined;
  showChecks: boolean;
  onChange: (record: ZoneRecord) => void;
  onDelete: () => void;
}

function emptyDataFor(type: RecordType): RecordData {
  switch (type) {
    case "SOA":
      return { type, data: { mname: "", rname: "", serial: "", refresh: "", retry: "", expire: "", minimum: "" } };
    case "NS":
    case "CNAME":
    case "PTR":
      return { type, data: { target: "" } };
    case "A":
    case "AAAA":
      return { type, data: { address: "" } };
    case "MX":
      return { type, data: { priority: "10", target: "" } };
    case "TXT":
      return { type, data: { text: "" } };
    case "SRV":
      return { type, data: { priority: "10", weight: "10", port: "", target: "" } };
    case "CAA":
      return { type, data: { flags: "0", tag: "issue", value: "" } };
  }
}

export function RecordRow({
  record,
  issues,
  checkResult,
  showChecks,
  onChange,
  onDelete,
}: RecordRowProps) {
  const generalIssues = issues.filter((i) => !i.field);

  const updateMeta = (patch: Partial<Pick<ZoneRecord, "name" | "ttl" | "class">>) =>
    onChange({ ...record, ...patch });

  const updateType = (type: RecordType) => onChange({ ...record, record: emptyDataFor(type) });

  const updateData = (data: RecordData["data"]) =>
    onChange({ ...record, record: { ...record.record, data } as RecordData });

  return (
    <div className="record">
      <div className="record-grid">
        <Field label="Name" error={fieldError(issues, "name")}>
          <input
            value={record.name}
            onChange={(e) => updateMeta({ name: e.target.value })}
            placeholder="@"
          />
        </Field>
        <Field label="TTL" error={fieldError(issues, "ttl")}>
          <input
            value={record.ttl}
            onChange={(e) => updateMeta({ ttl: e.target.value })}
            placeholder="(default)"
          />
        </Field>
        <Field label="Class" error={fieldError(issues, "class")}>
          <input
            value={record.class}
            onChange={(e) => updateMeta({ class: e.target.value })}
          />
        </Field>
        <Field label="Type">
          <select
            value={record.record.type}
            onChange={(e) => updateType(e.target.value as RecordType)}
          >
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <button className="delete" onClick={onDelete} title="Delete record">×</button>
      </div>

      <RdataEditor record={record} issues={issues} onChange={updateData} />

      {generalIssues.map((i, idx) => (
        <div key={idx} className={`issue ${i.severity}`}>{i.message}</div>
      ))}

      {showChecks && <ResolverChecks record={record} result={checkResult} />}
    </div>
  );
}
