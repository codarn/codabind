import { useMemo } from "react";
import { evaluateEmailConfig, type EmailCheck } from "../email/checks";
import { suggestDmarcStep, type DmarcSuggestion } from "../email/dmarc-ramp";
import type { Zone } from "../zone/types";

const STATUS_GLYPH: Record<EmailCheck["status"], string> = {
  ok: "✓",
  warn: "!",
  missing: "—",
};

interface Props {
  zone: Zone;
  onApplyDmarc?: (suggestion: DmarcSuggestion) => void;
}

export function EmailHealth({ zone, onApplyDmarc }: Props) {
  const checks = useMemo(() => evaluateEmailConfig(zone), [zone]);
  const dmarcSuggestion = useMemo(() => suggestDmarcStep(zone), [zone]);

  return (
    <section className="email-health" aria-label="Email deliverability checks">
      {checks.map((c) => {
        const suggestion = c.id === "dmarc" ? dmarcSuggestion : null;
        return (
          <Card
            key={c.id}
            check={c}
            suggestion={suggestion}
            onApply={
              suggestion && onApplyDmarc ? () => onApplyDmarc(suggestion) : undefined
            }
          />
        );
      })}
    </section>
  );
}

function Card({
  check,
  suggestion,
  onApply,
}: {
  check: EmailCheck;
  suggestion: DmarcSuggestion | null;
  onApply: (() => void) | undefined;
}) {
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
      {suggestion && onApply && (
        <div className="next-step">
          <div className="next-step-title">Next step: {suggestion.title}</div>
          <div className="next-step-rationale">{suggestion.rationale}</div>
          <code className="next-step-value">{suggestion.nextValue}</code>
          <button type="button" className="next-step-apply" onClick={onApply}>
            Apply
          </button>
        </div>
      )}
    </article>
  );
}
