import type { DohResolver } from "./resolvers";
import type { DohAnswer, ResolverResponse, ResolverStatus } from "./types";

const TIMEOUT_MS = 8_000;

interface DohJson {
  Status?: number;
  Answer?: Array<{ name?: unknown; type?: unknown; TTL?: unknown; data?: unknown }>;
}

function parseAnswer(raw: DohJson["Answer"]): DohAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => ({
    name: typeof a.name === "string" ? a.name : "",
    type: typeof a.type === "number" ? a.type : 0,
    TTL: typeof a.TTL === "number" ? a.TTL : 0,
    data: typeof a.data === "string" ? a.data : "",
  }));
}

function statusFromCode(code: number | undefined): ResolverStatus {
  if (code === 0) return "ok";
  if (code === 3) return "nxdomain";
  return "error";
}

export async function query(
  resolver: DohResolver,
  name: string,
  type: string,
  signal?: AbortSignal,
): Promise<ResolverResponse> {
  const start = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => ctrl.abort(), { once: true });

  try {
    const res = await fetch(resolver.url(name, type), {
      headers: { Accept: resolver.acceptHeader },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return {
        status: "error",
        answers: [],
        latencyMs: performance.now() - start,
        errorMessage: `HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as DohJson;
    return {
      status: statusFromCode(json.Status),
      answers: parseAnswer(json.Answer),
      latencyMs: performance.now() - start,
    };
  } catch (err) {
    return {
      status: "error",
      answers: [],
      latencyMs: performance.now() - start,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
