import { useState } from "react";
import { liveValueFor, PER_RESOLVER_OUTCOME, TYPE_TO_IANA } from "../dns/diff";
import { DEFAULT_RESOLVERS } from "../dns/resolvers";
import type {
  PerResolverOutcome,
  RecordCheckResult,
  ResolverResponse,
} from "../dns/types";
import type { ZoneRecord } from "../zone/types";

const STATUS_LABEL: Record<RecordCheckResult["status"], string> = {
  match: "✓ match",
  propagating: "propagating",
  mismatch: "mismatch",
  missing: "missing",
  diverged: "diverged",
  error: "error",
};

function outcomeClassFor(rec: ZoneRecord, resp: ResolverResponse | undefined): string {
  if (!resp) return "pending";
  return PER_RESOLVER_OUTCOME(rec, resp) satisfies PerResolverOutcome;
}

interface Props {
  record: ZoneRecord;
  result: RecordCheckResult | undefined;
}

export function ResolverChecks({ record, result }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!result) {
    return (
      <div className="resolver-checks">
        <div className="resolver-dots">
          {DEFAULT_RESOLVERS.map((r) => (
            <span key={r.id} className="dot pending" title={`${r.name} (${r.region})`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="resolver-checks">
      <button
        type="button"
        className={`check-status ${result.status}`}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {STATUS_LABEL[result.status]}
      </button>
      <div className="resolver-dots">
        {DEFAULT_RESOLVERS.map((r) => {
          const resp = result.perResolver.get(r.id);
          const cls = outcomeClassFor(record, resp);
          return (
            <span
              key={r.id}
              className={`dot ${cls}`}
              title={`${r.name} (${r.region})${resp ? `: ${describe(resp, record)}` : ""}`}
            />
          );
        })}
      </div>
      {expanded && <ExpandedView record={record} result={result} />}
    </div>
  );
}

function describe(resp: ResolverResponse, record: ZoneRecord): string {
  if (resp.status === "error") return resp.errorMessage ?? "error";
  if (resp.status === "nxdomain") return "NXDOMAIN";
  const ianaType = TYPE_TO_IANA[record.record.type];
  const matching = resp.answers.filter((a) => a.type === ianaType);
  if (matching.length === 0) return "no matching answer";
  return matching.map((a) => liveValueFor(record, a)).join(", ");
}

function ExpandedView({ record, result }: { record: ZoneRecord; result: RecordCheckResult }) {
  return (
    <table className="resolver-table">
      <thead>
        <tr>
          <th>Resolver</th>
          <th>Region</th>
          <th>Status</th>
          <th>Answer</th>
          <th>Latency</th>
        </tr>
      </thead>
      <tbody>
        {DEFAULT_RESOLVERS.map((r) => {
          const resp = result.perResolver.get(r.id);
          const cls = outcomeClassFor(record, resp);
          return (
            <tr key={r.id} className={`row ${cls}`}>
              <td>{r.name}</td>
              <td>{r.region}</td>
              <td>{resp ? cls : "pending"}</td>
              <td className="answer">{resp ? describe(resp, record) : "…"}</td>
              <td>{resp ? `${Math.round(resp.latencyMs)} ms` : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
