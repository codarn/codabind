import { useCallback, useState } from "react";
import { importFromDns as fetchFromDns } from "../dns/import";
import { DEFAULT_RESOLVERS } from "../dns/resolvers";
import { MAX_FILE_BYTES } from "../zone/constants";
import { parseZone } from "../zone/parser";
import { serializeZone } from "../zone/serializer";
import type { Zone } from "../zone/types";

interface UseZoneFile {
  parseErrors: string[];
  importedName: string;
  isResolving: boolean;
  importFile: (file: File) => Promise<Zone | null>;
  importFromDns: (resolverId: string, domain: string) => Promise<Zone | null>;
  exportZone: (zone: Zone) => void;
  reset: () => void;
}

export function useZoneFile(): UseZoneFile {
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importedName, setImportedName] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const importFile = useCallback(async (file: File): Promise<Zone | null> => {
    if (file.size > MAX_FILE_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      const limitMb = MAX_FILE_BYTES / 1024 / 1024;
      setParseErrors([`File too large (${sizeMb} MB). Limit is ${limitMb} MB.`]);
      setImportedName(file.name);
      return null;
    }
    const text = await file.text();
    const result = parseZone(text);
    setParseErrors(result.errors);
    setImportedName(file.name);
    return result.zone;
  }, []);

  const importFromDns = useCallback(
    async (resolverId: string, domain: string): Promise<Zone | null> => {
      setIsResolving(true);
      try {
        const result = await fetchFromDns(resolverId, domain);
        const resolver = DEFAULT_RESOLVERS.find((r) => r.id === resolverId);
        const label = resolver?.name ?? resolverId;
        const cleaned = domain.trim().replace(/\.$/, "");
        if (result.zone.records.length === 0 && result.errors.length === 0) {
          setParseErrors([`No records returned from ${label} for ${cleaned}.`]);
        } else {
          setParseErrors(result.errors);
        }
        setImportedName(`${cleaned} (via ${label})`);
        return result.zone;
      } finally {
        setIsResolving(false);
      }
    },
    [],
  );

  const exportZone = useCallback((zone: Zone) => {
    const text = serializeZone(zone);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = (zone.origin || "zone").replace(/\.$/, "") || "zone";
    a.download = `${base}.zone`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);

  const reset = useCallback(() => {
    setParseErrors([]);
    setImportedName("");
  }, []);

  return { parseErrors, importedName, isResolving, importFile, importFromDns, exportZone, reset };
}
