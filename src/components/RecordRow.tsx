import {
  RECORD_TYPES,
  type RecordData,
  type RecordType,
  type ValidationIssue,
  type ZoneRecord,
} from "../zone/types";

interface Props {
  record: ZoneRecord;
  issues: ValidationIssue[];
  onChange: (record: ZoneRecord) => void;
  onDelete: () => void;
}

function emptyDataFor(type: RecordType): RecordData {
  switch (type) {
    case "SOA":
      return { type, data: { mname: "", rname: "", serial: "", refresh: "", retry: "", expire: "", minimum: "" } };
    case "NS":
      return { type, data: { target: "" } };
    case "A":
      return { type, data: { address: "" } };
    case "AAAA":
      return { type, data: { address: "" } };
    case "CNAME":
      return { type, data: { target: "" } };
    case "MX":
      return { type, data: { priority: "10", target: "" } };
    case "TXT":
      return { type, data: { text: "" } };
    case "SRV":
      return { type, data: { priority: "10", weight: "10", port: "", target: "" } };
    case "PTR":
      return { type, data: { target: "" } };
    case "CAA":
      return { type, data: { flags: "0", tag: "issue", value: "" } };
  }
}

function fieldError(issues: ValidationIssue[], field: string): string | undefined {
  return issues.find((i) => i.field === field)?.message;
}

export function RecordRow({ record, issues, onChange, onDelete }: Props) {
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
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <button className="delete" onClick={onDelete} title="Delete record">
          ×
        </button>
      </div>

      <RdataEditor record={record} issues={issues} onChange={updateData} />

      {generalIssues.map((i, idx) => (
        <div key={idx} className={`issue ${i.severity}`}>
          {i.message}
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${error ? "field-error" : ""}`}>
      <span>{label}</span>
      {children}
      {error && <em>{error}</em>}
    </label>
  );
}

function RdataEditor({
  record,
  issues,
  onChange,
}: {
  record: ZoneRecord;
  issues: ValidationIssue[];
  onChange: (data: RecordData["data"]) => void;
}) {
  const r = record.record;
  const err = (f: string) => fieldError(issues, f);

  switch (r.type) {
    case "A":
    case "AAAA":
      return (
        <div className="rdata">
          <Field label="Address" error={err("address")}>
            <input
              value={r.data.address}
              onChange={(e) => onChange({ address: e.target.value })}
              placeholder={r.type === "A" ? "192.0.2.1" : "2001:db8::1"}
            />
          </Field>
        </div>
      );
    case "NS":
    case "CNAME":
    case "PTR":
      return (
        <div className="rdata">
          <Field label="Target" error={err("target")}>
            <input
              value={r.data.target}
              onChange={(e) => onChange({ target: e.target.value })}
              placeholder="ns1.example.com."
            />
          </Field>
        </div>
      );
    case "MX":
      return (
        <div className="rdata two">
          <Field label="Priority" error={err("priority")}>
            <input
              value={r.data.priority}
              onChange={(e) => onChange({ ...r.data, priority: e.target.value })}
            />
          </Field>
          <Field label="Target" error={err("target")}>
            <input
              value={r.data.target}
              onChange={(e) => onChange({ ...r.data, target: e.target.value })}
              placeholder="mail.example.com."
            />
          </Field>
        </div>
      );
    case "TXT":
      return (
        <div className="rdata">
          <Field label="Text" error={err("text")}>
            <input
              value={r.data.text}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder="v=spf1 -all"
            />
          </Field>
        </div>
      );
    case "SRV":
      return (
        <div className="rdata four">
          <Field label="Priority" error={err("priority")}>
            <input value={r.data.priority} onChange={(e) => onChange({ ...r.data, priority: e.target.value })} />
          </Field>
          <Field label="Weight" error={err("weight")}>
            <input value={r.data.weight} onChange={(e) => onChange({ ...r.data, weight: e.target.value })} />
          </Field>
          <Field label="Port" error={err("port")}>
            <input value={r.data.port} onChange={(e) => onChange({ ...r.data, port: e.target.value })} />
          </Field>
          <Field label="Target" error={err("target")}>
            <input value={r.data.target} onChange={(e) => onChange({ ...r.data, target: e.target.value })} />
          </Field>
        </div>
      );
    case "SOA":
      return (
        <div className="rdata soa">
          <Field label="Primary NS (mname)" error={err("mname")}>
            <input value={r.data.mname} onChange={(e) => onChange({ ...r.data, mname: e.target.value })} placeholder="ns1.example.com." />
          </Field>
          <Field label="Responsible (rname)" error={err("rname")}>
            <input value={r.data.rname} onChange={(e) => onChange({ ...r.data, rname: e.target.value })} placeholder="admin.example.com." />
          </Field>
          <Field label="Serial" error={err("serial")}>
            <input value={r.data.serial} onChange={(e) => onChange({ ...r.data, serial: e.target.value })} placeholder="2026010101" />
          </Field>
          <Field label="Refresh" error={err("refresh")}>
            <input value={r.data.refresh} onChange={(e) => onChange({ ...r.data, refresh: e.target.value })} placeholder="7200" />
          </Field>
          <Field label="Retry" error={err("retry")}>
            <input value={r.data.retry} onChange={(e) => onChange({ ...r.data, retry: e.target.value })} placeholder="3600" />
          </Field>
          <Field label="Expire" error={err("expire")}>
            <input value={r.data.expire} onChange={(e) => onChange({ ...r.data, expire: e.target.value })} placeholder="1209600" />
          </Field>
          <Field label="Minimum" error={err("minimum")}>
            <input value={r.data.minimum} onChange={(e) => onChange({ ...r.data, minimum: e.target.value })} placeholder="3600" />
          </Field>
        </div>
      );
    case "CAA":
      return (
        <div className="rdata three">
          <Field label="Flags" error={err("flags")}>
            <input value={r.data.flags} onChange={(e) => onChange({ ...r.data, flags: e.target.value })} />
          </Field>
          <Field label="Tag" error={err("tag")}>
            <input value={r.data.tag} onChange={(e) => onChange({ ...r.data, tag: e.target.value })} />
          </Field>
          <Field label="Value" error={err("value")}>
            <input value={r.data.value} onChange={(e) => onChange({ ...r.data, value: e.target.value })} placeholder='"letsencrypt.org"' />
          </Field>
        </div>
      );
  }
}
