import type { ZoneRecord } from "../zone/types";

export interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export type ResolverStatus = "ok" | "nxdomain" | "error";

export interface ResolverResponse {
  status: ResolverStatus;
  answers: DohAnswer[];
  latencyMs: number;
  errorMessage?: string;
}

export type RecordCheckStatus =
  | "match"
  | "propagating"
  | "mismatch"
  | "missing"
  | "diverged"
  | "error";

export interface RecordCheckResult {
  recordId: ZoneRecord["id"];
  perResolver: Map<string, ResolverResponse>;
  status: RecordCheckStatus;
}

export type PerResolverOutcome = "match" | "stale" | "missing" | "error";
