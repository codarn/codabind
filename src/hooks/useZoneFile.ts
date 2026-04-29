import { useCallback, useState } from "react";
import { MAX_FILE_BYTES } from "../zone/constants";
import { parseZone } from "../zone/parser";
import { serializeZone } from "../zone/serializer";
import type { Zone } from "../zone/types";

interface UseZoneFile {
  parseErrors: string[];
  importedName: string;
  importFile: (file: File) => Promise<Zone | null>;
  exportZone: (zone: Zone) => void;
  reset: () => void;
}

export function useZoneFile(): UseZoneFile {
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importedName, setImportedName] = useState("");

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

  return { parseErrors, importedName, importFile, exportZone, reset };
}
