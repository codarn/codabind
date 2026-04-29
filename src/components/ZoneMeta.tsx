import type { Zone } from "../zone/types";

interface ZoneMetaProps {
  zone: Zone;
  importedName: string;
  onChange: (zone: Zone) => void;
}

export function ZoneMeta({ zone, importedName, onChange }: ZoneMetaProps) {
  return (
    <section className="zone-meta">
      <label className="field">
        <span>$ORIGIN</span>
        <input
          value={zone.origin}
          onChange={(e) => onChange({ ...zone, origin: e.target.value })}
          placeholder="example.com."
        />
      </label>
      <label className="field">
        <span>$TTL</span>
        <input
          value={zone.ttl}
          onChange={(e) => onChange({ ...zone, ttl: e.target.value })}
          placeholder="3600"
        />
      </label>
      {importedName && <span className="imported">Imported: {importedName}</span>}
    </section>
  );
}
