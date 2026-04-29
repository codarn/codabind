import { useCallback, useRef, useState } from "react";
import { statusFor } from "../dns/diff";
import { query } from "../dns/query";
import { DEFAULT_RESOLVERS, type DohResolver } from "../dns/resolvers";
import type { RecordCheckResult, ResolverResponse } from "../dns/types";
import { fqdn } from "../zone/tree";
import type { Zone } from "../zone/types";

const CONCURRENCY = 8;

interface UseDnsCheck {
  results: Map<string, RecordCheckResult>;
  isChecking: boolean;
  enabledResolvers: Set<string>;
  toggleResolver: (id: string) => void;
  checkAll: (zone: Zone) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const idx = cursor++;
      const task = tasks[idx];
      if (task) await task();
    }
  });
  await Promise.all(workers);
}

export function useDnsCheck(): UseDnsCheck {
  const [results, setResults] = useState<Map<string, RecordCheckResult>>(new Map());
  const [isChecking, setIsChecking] = useState(false);
  const [enabledResolvers, setEnabledResolvers] = useState<Set<string>>(
    () => new Set(DEFAULT_RESOLVERS.map((r) => r.id)),
  );
  const abortRef = useRef<AbortController | null>(null);

  const toggleResolver = useCallback((id: string) => {
    setEnabledResolvers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const checkAll = useCallback(
    async (zone: Zone) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsChecking(true);
      setResults(new Map());

      const resolvers: DohResolver[] = DEFAULT_RESOLVERS.filter((r) =>
        enabledResolvers.has(r.id),
      );
      if (resolvers.length === 0 || zone.records.length === 0) {
        setIsChecking(false);
        return;
      }

      const perRecord = new Map<string, Map<string, ResolverResponse>>();
      const tasks: Array<() => Promise<void>> = [];

      for (const rec of zone.records) {
        perRecord.set(rec.id, new Map());
        for (const resolver of resolvers) {
          tasks.push(async () => {
            if (ctrl.signal.aborted) return;
            const name = fqdn(rec, zone.origin);
            const resp = await query(resolver, name, rec.record.type, ctrl.signal);
            if (ctrl.signal.aborted) return;
            const map = perRecord.get(rec.id);
            if (!map) return;
            map.set(resolver.id, resp);
            const status = statusFor(rec, map);
            setResults((prev) => {
              const next = new Map(prev);
              next.set(rec.id, { recordId: rec.id, perResolver: map, status });
              return next;
            });
          });
        }
      }

      await runWithConcurrency(tasks, CONCURRENCY);
      if (!ctrl.signal.aborted) setIsChecking(false);
    },
    [enabledResolvers],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsChecking(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResults(new Map());
    setIsChecking(false);
  }, []);

  return { results, isChecking, enabledResolvers, toggleResolver, checkAll, cancel, reset };
}
