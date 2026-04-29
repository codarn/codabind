import type { ValidationIssue } from "../zone/types";

interface IssuesPanelProps {
  parseErrors: string[];
  globalIssues: ValidationIssue[];
}

export function IssuesPanel({ parseErrors, globalIssues }: IssuesPanelProps) {
  if (parseErrors.length === 0 && globalIssues.length === 0) return null;

  return (
    <>
      {parseErrors.length > 0 && (
        <section className="parse-errors">
          <strong>Parse errors:</strong>
          <ul>
            {parseErrors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </section>
      )}
      {globalIssues.length > 0 && (
        <section className="parse-errors">
          <strong>Zone issues:</strong>
          <ul>
            {globalIssues.map((issue, i) => (
              <li key={i} className={issue.severity}>{issue.message}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
