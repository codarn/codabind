import { useMemo } from "react";
import { evaluateEmailConfig, type EmailCheck } from "../email/checks";
import type { Zone } from "../zone/types";

const STATUS_GLYPH: Record<EmailCheck["status"], string> = {
  ok: "✓",
  warn: "!",
  missing: "—",
};

interface Props {
  zone: Zone;
}

export function EmailHealth({ zone }: Props) {
  const checks = useMemo(() => evaluateEmailConfig(zone), [zone]);
  return (
    <section className="email-health" aria-label="Email deliverability checks">
      {checks.map((c) => (
        <Card key={c.id} check={c} />
      ))}
    </section>
  );
}

function Card({ check }: { check: EmailCheck }) {
  return (
    <article className={`email-card ${check.status}`}>
      <header>
        <span className="title">{check.title}</span>
        <span className="status" aria-label={check.status}>{STATUS_GLYPH[check.status]}</span>
      </header>
      <div className="summary">{check.summary}</div>
      {check.details.length > 0 && (
        <ul className="details">
          {check.details.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
