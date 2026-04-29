import type { ReactNode } from "react";
import type { ValidationIssue } from "../zone/types";

interface FieldProps {
  label: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, error, children }: FieldProps) {
  return (
    <label className={`field ${error ? "field-error" : ""}`}>
      <span>{label}</span>
      {children}
      {error && <em>{error}</em>}
    </label>
  );
}

export function fieldError(issues: ValidationIssue[], field: string): string | undefined {
  return issues.find((i) => i.field === field)?.message;
}
