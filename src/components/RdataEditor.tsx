import type { ChangeEvent } from "react";
import type {
  CaaData,
  RecordData,
  SoaData,
  ValidationIssue,
  ZoneRecord,
} from "../zone/types";
import { Field, fieldError } from "./Field";

interface RdataEditorProps {
  record: ZoneRecord;
  issues: ValidationIssue[];
  onChange: (data: RecordData["data"]) => void;
}

function bindFor<D extends object>(data: D, onChange: (data: D) => void) {
  return <K extends keyof D & string>(field: K) => ({
    value: String(data[field] ?? ""),
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      onChange({ ...data, [field]: e.target.value } as D),
  });
}

const SOA_FIELDS: Array<{ key: keyof SoaData; label: string; placeholder: string }> = [
  { key: "mname", label: "Primary NS (mname)", placeholder: "ns1.example.com." },
  { key: "rname", label: "Responsible (rname)", placeholder: "admin.example.com." },
  { key: "serial", label: "Serial", placeholder: "2026010101" },
  { key: "refresh", label: "Refresh", placeholder: "7200" },
  { key: "retry", label: "Retry", placeholder: "3600" },
  { key: "expire", label: "Expire", placeholder: "1209600" },
  { key: "minimum", label: "Minimum", placeholder: "3600" },
];

const CAA_FIELDS: Array<{ key: keyof CaaData; label: string; placeholder?: string }> = [
  { key: "flags", label: "Flags" },
  { key: "tag", label: "Tag" },
  { key: "value", label: "Value", placeholder: '"letsencrypt.org"' },
];

export function RdataEditor({ record, issues, onChange }: RdataEditorProps) {
  const r = record.record;
  const err = (f: string) => fieldError(issues, f);

  switch (r.type) {
    case "A":
    case "AAAA": {
      const bind = bindFor(r.data, onChange);
      const placeholder = r.type === "A" ? "192.0.2.1" : "2001:db8::1";
      return (
        <div className="rdata">
          <Field label="Address" error={err("address")}>
            <input {...bind("address")} placeholder={placeholder} />
          </Field>
        </div>
      );
    }
    case "NS":
    case "CNAME":
    case "PTR": {
      const bind = bindFor(r.data, onChange);
      return (
        <div className="rdata">
          <Field label="Target" error={err("target")}>
            <input {...bind("target")} placeholder="ns1.example.com." />
          </Field>
        </div>
      );
    }
    case "MX": {
      const bind = bindFor(r.data, onChange);
      return (
        <div className="rdata two">
          <Field label="Priority" error={err("priority")}>
            <input {...bind("priority")} />
          </Field>
          <Field label="Target" error={err("target")}>
            <input {...bind("target")} placeholder="mail.example.com." />
          </Field>
        </div>
      );
    }
    case "TXT": {
      const bind = bindFor(r.data, onChange);
      return (
        <div className="rdata">
          <Field label="Text" error={err("text")}>
            <input {...bind("text")} placeholder="v=spf1 -all" />
          </Field>
        </div>
      );
    }
    case "SRV": {
      const bind = bindFor(r.data, onChange);
      return (
        <div className="rdata four">
          <Field label="Priority" error={err("priority")}><input {...bind("priority")} /></Field>
          <Field label="Weight" error={err("weight")}><input {...bind("weight")} /></Field>
          <Field label="Port" error={err("port")}><input {...bind("port")} /></Field>
          <Field label="Target" error={err("target")}><input {...bind("target")} /></Field>
        </div>
      );
    }
    case "SOA": {
      const bind = bindFor(r.data, onChange);
      return (
        <div className="rdata soa">
          {SOA_FIELDS.map(({ key, label, placeholder }) => (
            <Field key={key} label={label} error={err(key)}>
              <input {...bind(key)} placeholder={placeholder} />
            </Field>
          ))}
        </div>
      );
    }
    case "CAA": {
      const bind = bindFor(r.data, onChange);
      return (
        <div className="rdata three">
          {CAA_FIELDS.map(({ key, label, placeholder }) => (
            <Field key={key} label={label} error={err(key)}>
              <input {...bind(key)} placeholder={placeholder} />
            </Field>
          ))}
        </div>
      );
    }
  }
}
